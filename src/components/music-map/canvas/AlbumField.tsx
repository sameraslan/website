"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { ALBUM_FRAGMENT_SHADER, ALBUM_VERTEX_SHADER } from "../shaders/album";
import type { MapData, MetadataRecord, PositionRecord } from "../data/types";
import { clusterMedians, clusterMemberCounts } from "../state/centroids";
import { clusterColorsFromRegions } from "../state/clusterColors";
import { markFirstDraw } from "../state/debug";
import { interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { getOverviewFraming } from "../state/view";

// Viewport-relative sprite cap: a single album cover should never dominate
// more than 18% of the viewport height, even at max zoom on a short window
// (spec 4.3 / task-8 brief).
const MAX_SPRITE_VIEWPORT_FRACTION = 0.18;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface AlbumFieldProps {
  data: MapData;
  atlasTextures: (THREE.Texture | null)[];
  /** Real camera.zoom (0.5..5), written every frame by CameraRig. */
  zoomRef: React.MutableRefObject<number>;
  cursorRef: React.MutableRefObject<[number, number] | null>;
  /** -1 = no hover target. Written by CursorTracker on pointermove. */
  hoverRef: React.MutableRefObject<number>;
  /**
   * Flat [x0,y0,x1,y1,...] interpolated positions. Owned by AlbumField,
   * recomputed only when sliderT changes (not per frame); CursorTracker and
   * TooltipDriver read it for hit-testing and tooltip placement.
   */
  positionsRef: React.MutableRefObject<Float32Array>;
  /**
   * Flat [x0,y0,...] per-cluster median positions at the current sliderT
   * (state/centroids.ts clusterMedians, robust to the outlier group),
   * recomputed alongside positionsRef whenever the slider changes. Read by
   * the region-labels driver (canvas/RegionLabels.tsx) to place each label.
   * Length is regionCount * 2; a cluster with no members gets NaN (label
   * driver hides it).
   */
  centroidsRef: React.MutableRefObject<Float32Array>;
  /**
   * Member count per clusterId, computed once per data load (membership
   * doesn't change with sliderT). Read by the region-labels driver to hide
   * labels for clusters too small to mean anything (task 8 fix round 2).
   */
  clusterCountsRef: React.MutableRefObject<Uint32Array>;
  focusedIndex: number;
  neighborIndices: number[];
}

const MAX_ATLASES = 5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

export function AlbumField({
  data,
  atlasTextures,
  zoomRef,
  cursorRef,
  hoverRef,
  positionsRef,
  centroidsRef,
  clusterCountsRef,
  focusedIndex,
  neighborIndices,
}: AlbumFieldProps) {
  const sliderT = useMapStore((s) => s.sliderT);
  const { gl } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const regionCount = data.regions.length;
  // clusterId per album, rebuilt whenever data changes; read by the
  // positions effect below to recompute per-cluster centroids on every
  // sliderT change. Built in its own memo (not inside the geometry memo)
  // so the ref sync below can happen in an effect rather than during render.
  const clusterIds8 = useMemo(() => {
    const n = data.positions.length;
    const arr = new Uint8Array(n);
    const metaById = new Map<string, MetadataRecord>();
    for (const m of data.metadata) metaById.set(m.id, m);
    for (let i = 0; i < n; i++) {
      const meta = metaById.get(data.positions[i].id);
      if (meta) arr[i] = meta.clusterId;
    }
    return arr;
  }, [data]);
  const clusterIdsRef = useRef<Uint8Array>(clusterIds8);
  useEffect(() => {
    clusterIdsRef.current = clusterIds8;
  }, [clusterIds8]);
  // Member count per clusterId: fixed per data load (unlike centroids, this
  // doesn't depend on sliderT), so it's computed once here alongside
  // clusterIds8 rather than in the per-sliderT-change effect below.
  const clusterCounts = useMemo(
    () => clusterMemberCounts(clusterIds8, data.positions.length, regionCount),
    [clusterIds8, data.positions.length, regionCount],
  );
  useEffect(() => {
    clusterCountsRef.current = clusterCounts;
  }, [clusterCounts, clusterCountsRef]);
  const reducedMotionRef = useRef(prefersReducedMotion());
  // Tracks the previous frame's hover uniform so we only invalidate() (under
  // frameloop="demand") on an actual change, not every frame.
  const prevHoverRef = useRef(-1);

  const { geometry, material } = useMemo(() => {
    const pointsGeom = new THREE.InstancedBufferGeometry();
    // A single 0-position vertex; the rest comes from instanced attributes
    pointsGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0], 3),
    );

    const n = data.positions.length;
    const audio = new Float32Array(n * 2);
    const balanced = new Float32Array(n * 2);
    const mood = new Float32Array(n * 2);
    const atlasUV = new Float32Array(n * 4);
    const atlasIdx = new Float32Array(n);
    const clusterIds = new Float32Array(n);

    // Build an id → metadata index so positions and metadata align by id
    const metaById = new Map<string, MetadataRecord>();
    for (const m of data.metadata) metaById.set(m.id, m);

    for (let i = 0; i < n; i++) {
      const pos: PositionRecord = data.positions[i];
      audio[i * 2 + 0] = pos.audio[0];
      audio[i * 2 + 1] = pos.audio[1];
      balanced[i * 2 + 0] = pos.balanced[0];
      balanced[i * 2 + 1] = pos.balanced[1];
      mood[i * 2 + 0] = pos.mood[0];
      mood[i * 2 + 1] = pos.mood[1];
      const meta = metaById.get(pos.id);
      if (meta) {
        atlasUV[i * 4 + 0] = meta.atlasUV[0];
        atlasUV[i * 4 + 1] = meta.atlasUV[1];
        atlasUV[i * 4 + 2] = meta.atlasUV[2];
        atlasUV[i * 4 + 3] = meta.atlasUV[3];
        atlasIdx[i] = meta.atlasIndex;
        clusterIds[i] = meta.clusterId;
      }
    }

    pointsGeom.setAttribute("a_pos_audio", new THREE.InstancedBufferAttribute(audio, 2));
    pointsGeom.setAttribute("a_pos_balanced", new THREE.InstancedBufferAttribute(balanced, 2));
    pointsGeom.setAttribute("a_pos_mood", new THREE.InstancedBufferAttribute(mood, 2));
    pointsGeom.setAttribute("a_atlasUV", new THREE.InstancedBufferAttribute(atlasUV, 4));
    pointsGeom.setAttribute("a_atlasIndex", new THREE.InstancedBufferAttribute(atlasIdx, 1));
    pointsGeom.setAttribute("a_clusterId", new THREE.InstancedBufferAttribute(clusterIds, 1));
    pointsGeom.instanceCount = n;

    const atlasLoadedFloats = new Float32Array(MAX_ATLASES);
    // Dot colours come from the data (regions.json, by clusterId), the same
    // source the region labels use, so dots and labels always agree.
    const clusterColorsVec3 = clusterColorsFromRegions(data.regions, 8).map(
      (c) => new THREE.Vector3(...c),
    );

    const mat = new THREE.ShaderMaterial({
      vertexShader: ALBUM_VERTEX_SHADER,
      fragmentShader: ALBUM_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_sliderT: { value: 0.5 },
        u_zoomT: { value: 0 },
        u_zoom: { value: 2.4 },
        // Published by InitialFrame before the first frame; never 0.
        u_fitZoom: { value: getOverviewFraming().zoom },
        u_pixelRatio: { value: gl.getPixelRatio() },
        u_focusedAlbumIndex: { value: -1 },
        u_neighborMask: { value: new Float32Array(12).fill(-1) },
        u_hoverIndex: { value: -1 },
        u_maxSpritePx: { value: 240 },
        u_cursor: { value: new THREE.Vector2(0, 0) },
        u_cursorActive: { value: 0 },
        u_atlas0: { value: null },
        u_atlas1: { value: null },
        u_atlas2: { value: null },
        u_atlas3: { value: null },
        u_atlas4: { value: null },
        u_atlasLoaded: { value: atlasLoadedFloats },
        u_clusterColors: { value: clusterColorsVec3 },
      },
    });
    return { geometry: pointsGeom, material: mat };
  }, [data, gl]);

  // Interpolated positions used for hit-testing (CursorTracker) and tooltip
  // placement (TooltipDriver): a flat typed array recomputed only when
  // sliderT changes, not per frame, so hover hit-testing stays a cheap
  // typed-array scan rather than recomputing interpolation on every move.
  useEffect(() => {
    const n = data.positions.length;
    let arr = positionsRef.current;
    if (arr.length !== n * 2) {
      arr = new Float32Array(n * 2);
      positionsRef.current = arr;
    }
    for (let i = 0; i < n; i++) {
      const p = data.positions[i];
      const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
      arr[i * 2] = x;
      arr[i * 2 + 1] = y;
    }
    // Recompute per-cluster label anchors (medians) alongside positions, so
    // the region labels driver always reads anchors consistent with the current
    // sliderT rather than a stale value from regions.json.
    centroidsRef.current = clusterMedians(arr, clusterIdsRef.current, n, regionCount);
  }, [data, sliderT, positionsRef, centroidsRef, regionCount]);

  // Viewport-relative sprite cap: recomputed on mount and whenever the
  // canvas resizes, from the CSS-px viewport height and the current device
  // pixel ratio (see the gl_PointSize clamp in shaders/album.ts).
  useEffect(() => {
    material.uniforms.u_maxSpritePx.value =
      size.height * MAX_SPRITE_VIEWPORT_FRACTION * gl.getPixelRatio();
    invalidate();
  }, [material, size.height, gl, invalidate]);

  // Push texture changes into uniforms
  useEffect(() => {
    for (let i = 0; i < MAX_ATLASES; i++) {
      const tex = atlasTextures[i] ?? null;
      material.uniforms[`u_atlas${i}`].value = tex;
      material.uniforms.u_atlasLoaded.value[i] = tex ? 1 : 0;
    }
    material.uniformsNeedUpdate = true;
  }, [atlasTextures, material]);

  useFrame(() => {
    material.uniforms.u_sliderT.value = sliderT;
    const zoomT = Math.max(
      0,
      Math.min(1, (zoomRef.current - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)),
    );
    material.uniforms.u_zoomT.value = zoomT;
    // Real camera.zoom (not normalized): drives the sprite-size power curve
    // in the vertex shader so overview stays small discs and covers only
    // read once the user zooms in (controller-inspection fix, task 8 round 1).
    material.uniforms.u_zoom.value = zoomRef.current;
    // The zoom at which the whole album cloud fits the frustum: the size
    // curve above is relative to this, not a fixed absolute zoom (task 8
    // fix round 2).
    material.uniforms.u_fitZoom.value = getOverviewFraming().zoom;
    material.uniforms.u_focusedAlbumIndex.value = focusedIndex;
    const mask = material.uniforms.u_neighborMask.value as Float32Array;
    mask.fill(-1);
    mask[0] = focusedIndex;
    for (let i = 0; i < neighborIndices.length && i < 11; i++) {
      mask[i + 1] = neighborIndices[i];
    }
    // Cursor uniforms. We disable the directional pull when the user
    // prefers reduced motion, the dot offsetting is a small but
    // continuous animation that some vestibular-sensitive users find
    // distracting. matchMedia is read on mount and cached in the closure;
    // the rare media-query change at runtime isn't worth a listener.
    const c = cursorRef.current;
    material.uniforms.u_cursorActive.value = c && !reducedMotionRef.current ? 1 : 0;
    if (c) {
      material.uniforms.u_cursor.value.set(c[0], c[1]);
    }

    const hv = hoverRef.current;
    material.uniforms.u_hoverIndex.value = hv;
    if (hv !== prevHoverRef.current) {
      prevHoverRef.current = hv;
      // Under frameloop="demand", the ring/scale change needs its own frame
      // to actually draw (CursorTracker already invalidates on the
      // pointermove that caused this, but this covers any other path that
      // changes hoverRef without going through CursorTracker's handler).
      invalidate();
    }
  });

  // Use refs for cleanup
  const points = useRef<THREE.Points>(null);
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // Dev-only: records the first time this component renders with real data,
  // for the Fast-3G "time to first draw" verification (task 9). AlbumField
  // only ever renders once `data` is set on the store (MusicMap.tsx gates
  // <Scene> on `data`), so this fires once per page load.
  useEffect(() => {
    markFirstDraw();
  }, []);

  // Frustum-cull off: the geometry's only position attribute is the
  // single 0-vertex stub for instanced draw, so Three's auto-computed
  // bounding sphere has radius 0 at the origin. Any time the camera
  // recentres off-origin (focus, off-center zoom), that sphere falls
  // outside the frustum and Three skips the whole draw, every album
  // disappears, including the focused one.
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
