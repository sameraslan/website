"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { ALBUM_FRAGMENT_SHADER, ALBUM_VERTEX_SHADER, CLUSTER_COLORS_RGB } from "../shaders/album";
import type { MapData, MetadataRecord, PositionRecord } from "../data/types";
import { useMapStore } from "../state/store";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface AlbumFieldProps {
  data: MapData;
  atlasTextures: (THREE.Texture | null)[];
  zoomT: number;
  cursorWorld: [number, number] | null;
  focusedIndex: number;
  neighborIndices: number[];
}

const MAX_ATLASES = 5;

export function AlbumField({
  data,
  atlasTextures,
  zoomT,
  cursorWorld,
  focusedIndex,
  neighborIndices,
}: AlbumFieldProps) {
  const sliderT = useMapStore((s) => s.sliderT);
  const { gl } = useThree();
  const reducedMotionRef = useRef(prefersReducedMotion());

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
    const clusterColorsVec3 = CLUSTER_COLORS_RGB.map((c) => new THREE.Vector3(...c));

    const mat = new THREE.ShaderMaterial({
      vertexShader: ALBUM_VERTEX_SHADER,
      fragmentShader: ALBUM_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_sliderT: { value: 0.5 },
        u_zoomT: { value: 0 },
        u_pixelRatio: { value: gl.getPixelRatio() },
        u_focusedAlbumIndex: { value: -1 },
        u_neighborMask: { value: new Float32Array(12).fill(-1) },
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
    material.uniforms.u_zoomT.value = zoomT;
    material.uniforms.u_focusedAlbumIndex.value = focusedIndex;
    const mask = material.uniforms.u_neighborMask.value as Float32Array;
    mask.fill(-1);
    mask[0] = focusedIndex;
    for (let i = 0; i < neighborIndices.length && i < 11; i++) {
      mask[i + 1] = neighborIndices[i];
    }
    // Cursor uniforms. We disable the directional pull when the user
    // prefers reduced motion — the dot offsetting is a small but
    // continuous animation that some vestibular-sensitive users find
    // distracting. matchMedia is read on mount and cached in the closure;
    // the rare media-query change at runtime isn't worth a listener.
    const c = cursorWorld;
    material.uniforms.u_cursorActive.value = c && !reducedMotionRef.current ? 1 : 0;
    if (c) {
      material.uniforms.u_cursor.value.set(c[0], c[1]);
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

  return <points ref={points} geometry={geometry} material={material} />;
}
