"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  ALBUM_FRAGMENT_SHADER,
  ALBUM_VERTEX_SHADER,
  MAX_SPRITE_VIEWPORT_FRACTION,
  spriteCssSize,
} from "../shaders/album";
import type { MapData, MetadataRecord, PositionRecord } from "../data/types";
import { clusterColorsFromRegions } from "../state/clusterColors";
import { markFirstDraw, registerDebug } from "../state/debug";
import { interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { getOverviewFraming } from "../state/view";
import { cursorToWorld } from "./CursorTracker";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface AlbumFieldProps {
  data: MapData;
  atlasTextures: (THREE.Texture | null)[];
  /** Real camera.zoom (0.5..5), written every frame by CameraRig. */
  zoomRef: React.MutableRefObject<number>;
  /** Canvas-relative CSS px of the mouse (null = off canvas), from CursorTracker. */
  cursorRef: React.MutableRefObject<[number, number] | null>;
  /** -1 = no hover target. Written by CursorTracker on pointermove. */
  hoverRef: React.MutableRefObject<number>;
  /**
   * Flat [x0,y0,x1,y1,...] interpolated positions. Owned by AlbumField,
   * recomputed only when sliderT changes (not per frame); CursorTracker and
   * TooltipDriver read it for hit-testing and tooltip placement.
   */
  positionsRef: React.MutableRefObject<Float32Array>;
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
  focusedIndex,
  neighborIndices,
}: AlbumFieldProps) {
  const sliderT = useMapStore((s) => s.sliderT);
  const { gl, camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
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
    // Dot colours come from the data (regions.json `color`, by clusterId),
    // so the palette is set in one place (pipeline/config.yaml).
    const clusterColorsVec3 = clusterColorsFromRegions(data.regions, 8).map(
      (c) => new THREE.Vector3(...c),
    );

    const mat = new THREE.ShaderMaterial({
      vertexShader: ALBUM_VERTEX_SHADER,
      fragmentShader: ALBUM_FRAGMENT_SHADER,
      transparent: true,
      // Depth carries the focus/hover draw-order layers (see `layer` in the
      // vertex shader). Three's default depthFunc is LessEqual, so sprites
      // in the same layer still draw in plain instance order; the fragment
      // shader discards outside the disc, so the sprite quad's corners never
      // write depth.
      depthWrite: true,
      depthTest: true,
      depthFunc: THREE.LessEqualDepth,
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
      // eslint-disable-next-line react-hooks/immutability -- arr is the ref's mutable backing Float32Array; writing into it in place avoids reallocating a ~5k-float array on every sliderT tick.
      arr[i * 2] = x;
      arr[i * 2 + 1] = y;
    }
  }, [data, sliderT, positionsRef]);

  // Push texture changes into uniforms
  useEffect(() => {
    for (let i = 0; i < MAX_ATLASES; i++) {
      const tex = atlasTextures[i] ?? null;
      // eslint-disable-next-line react-hooks/immutability -- same in-place uniform mutation pattern as above.
      material.uniforms[`u_atlas${i}`].value = tex;
      material.uniforms.u_atlasLoaded.value[i] = tex ? 1 : 0;
    }
    // eslint-disable-next-line react-hooks/immutability -- flags the material dirty after the uniform writes above; also the R3F mutation pattern.
    material.uniformsNeedUpdate = true;
    // frameloop="demand": a texture arriving is not an input event, so
    // request the frame that actually draws the new covers.
    invalidate();
  }, [atlasTextures, material, invalidate]);

  // eslint-disable-next-line react-hooks/immutability -- this per-frame callback mutates material.uniforms in place throughout (see the mutation sites below); that is the standard R3F hot-path pattern, not something to restructure into setState (which would re-render React every frame instead of just redrawing the canvas).
  useFrame((state) => {
    // eslint-disable-next-line react-hooks/immutability -- see the useFrame-level comment above.
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
    // Pixel ratio and the viewport-relative sprite cap (see the gl_PointSize
    // clamp in shaders/album.ts), read live each frame so a dpr change (a
    // window moved to another display) or a resize can't leave them stale;
    // renderedSpriteCssSize, which hit testing and label placement use,
    // reads the same live values.
    const dpr = gl.getPixelRatio();
    material.uniforms.u_pixelRatio.value = dpr;
    material.uniforms.u_maxSpritePx.value = state.size.height * MAX_SPRITE_VIEWPORT_FRACTION * dpr;
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
    // cursorRef holds canvas-relative CSS px; it is projected through the
    // camera as it is this frame, so the pull stays under the mouse while
    // the camera moves.
    const c = cursorRef.current;
    material.uniforms.u_cursorActive.value = c && !reducedMotionRef.current ? 1 : 0;
    if (c) {
      const [wx, wy] = cursorToWorld(c, state.size, camera as THREE.OrthographicCamera);
      material.uniforms.u_cursor.value.set(wx, wy);
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

  // Records the first time this component renders with real data, for the
  // Fast-3G "time to first draw" verification (task 9). Unlike the other
  // debug hooks this one also runs in production (see markFirstDraw). AlbumField
  // only ever renders once `data` is set on the store (MusicMap.tsx gates
  // <Scene> on `data`), so this fires once per page load.
  useEffect(() => {
    markFirstDraw();
  }, []);

  // Dev-only: exposes the sprite size the shader is actually computing, from
  // the live material uniforms as well as from the camera + published fit
  // (see DebugGetters.getSpriteCssSize). No-op in production.
  useEffect(() => {
    registerDebug({
        getSpriteCssSize: () => {
          const u = material.uniforms;
          const dpr = u.u_pixelRatio.value as number;
          const maxSpritePx = u.u_maxSpritePx.value as number;
          const ctx = gl.getContext();
          const range = Array.from(
            ctx.getParameter(ctx.ALIASED_POINT_SIZE_RANGE) as Float32Array,
          ) as [number, number];
          const uniform = spriteCssSize(u.u_zoom.value, u.u_fitZoom.value);
          const deviceCap = Math.min(240, maxSpritePx, range[1]);
          return {
            published: spriteCssSize(camera.zoom, getOverviewFraming().zoom),
            uniform,
            effective: Math.min(uniform * dpr, deviceCap) / dpr,
            cameraZoom: camera.zoom,
            publishedFitZoom: getOverviewFraming().zoom,
            uZoom: u.u_zoom.value,
            uFitZoom: u.u_fitZoom.value,
            pixelRatio: dpr,
            maxSpritePx,
            pointSizeRange: range,
          };
        },
    });
    // Remove only this getter; registerDebug's own cleanup would delete the
    // whole window.__mapDebug object, including DebugExpose's getters.
    return () => {
      if (typeof window !== "undefined" && window.__mapDebug) {
        delete window.__mapDebug.getSpriteCssSize;
      }
    };
  }, [material, gl, camera]);

  // Frustum-cull off: the geometry's only position attribute is the
  // single 0-vertex stub for instanced draw, so Three's auto-computed
  // bounding sphere has radius 0 at the origin. Any time the camera
  // recentres off-origin (focus, off-center zoom), that sphere falls
  // outside the frustum and Three skips the whole draw, every album
  // disappears, including the focused one.
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
