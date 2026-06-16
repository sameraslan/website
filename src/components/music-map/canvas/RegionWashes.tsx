"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { WASH_FRAGMENT_SHADER, WASH_VERTEX_SHADER } from "../shaders/wash";
import type { RegionRecord } from "../data/types";
import { useMapStore } from "../state/store";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255,
  ];
}

interface Props {
  regions: RegionRecord[];
  zoomT: number;
}

export function RegionWashes({ regions, zoomT }: Props) {
  const sliderT = useMapStore((s) => s.sliderT);

  const { geometry, material } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const inst = new THREE.InstancedBufferGeometry();
    inst.index = quad.index;
    inst.attributes.position = quad.attributes.position;
    inst.attributes.uv = quad.attributes.uv;

    const n = regions.length;
    const cA = new Float32Array(n * 2);
    const cB = new Float32Array(n * 2);
    const cM = new Float32Array(n * 2);
    const radius = new Float32Array(n);
    const color = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      const r = regions[i];
      cA[i * 2 + 0] = r.stops.audio.centroid[0];
      cA[i * 2 + 1] = r.stops.audio.centroid[1];
      cB[i * 2 + 0] = r.stops.balanced.centroid[0];
      cB[i * 2 + 1] = r.stops.balanced.centroid[1];
      cM[i * 2 + 0] = r.stops.mood.centroid[0];
      cM[i * 2 + 1] = r.stops.mood.centroid[1];
      // Inflate radius so washes overlap and breathe past their cluster
      // bbox — the watercolor effect needs more room than the tight kmeans
      // radius. Some regions have radius=0 in the source data (small
      // clusters that didn't survive spread); clamp to a sensible minimum.
      const rawRadius = r.stops.balanced.radius;
      radius[i] = Math.max(0.28, rawRadius * 2.4);
      const [cr, cg, cb] = hexToRgb(r.color);
      color[i * 3 + 0] = cr;
      color[i * 3 + 1] = cg;
      color[i * 3 + 2] = cb;
    }

    inst.setAttribute("a_centroid_audio", new THREE.InstancedBufferAttribute(cA, 2));
    inst.setAttribute("a_centroid_balanced", new THREE.InstancedBufferAttribute(cB, 2));
    inst.setAttribute("a_centroid_mood", new THREE.InstancedBufferAttribute(cM, 2));
    inst.setAttribute("a_radius", new THREE.InstancedBufferAttribute(radius, 1));
    inst.setAttribute("a_color", new THREE.InstancedBufferAttribute(color, 3));
    inst.instanceCount = n;

    const mat = new THREE.ShaderMaterial({
      vertexShader: WASH_VERTEX_SHADER,
      fragmentShader: WASH_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_sliderT: { value: sliderT },
        u_zoomT: { value: zoomT },
      },
      // NormalBlending is safe because BackgroundLayer paints paper across
      // the whole frustum at depth=-10 before this draws (renderOrder=-100,
      // but z=-5 puts it ABOVE the background). The wash fragment shader
      // outputs paper*color with a soft Gaussian alpha, so any leak through
      // a low-alpha edge composites onto paper-coloured pixels, not white.
      blending: THREE.NormalBlending,
    });
    return { geometry: inst, material: mat };
  }, [regions]);

  material.uniforms.u_sliderT.value = sliderT;
  material.uniforms.u_zoomT.value = zoomT;

  return <mesh geometry={geometry} material={material} position={[0, 0, -5]} renderOrder={-100} />;
}
