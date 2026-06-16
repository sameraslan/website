"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { RegionRecord, SliderStopId } from "../data/types";
import { useMapStore } from "../state/store";

// Render each label to a hi-DPI canvas in italic Georgia / ink-muted, then
// upload as a Three.js texture for a Sprite. SDF would be lighter but a
// per-label canvas at 1024×256 is still well under any budget — there are
// only 8 regions.
function makeLabelTexture(text: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  // 4× the visible sprite size to keep edges crisp when sampled.
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "italic 140px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  // Labels draw BEHIND the album points (renderOrder = -50, set on the
  // sprite). A faint paper-coloured stroke gives the glyph just enough
  // contrast to remain readable when the underlying watercolor wash is
  // dark; the dots overdraw the halo so the cluster ink reading stays
  // intact. lineWidth=6 is narrow enough to fit between adjacent dots.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(246, 240, 225, 0.7)";
  ctx.lineWidth = 6;
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = "#6b6852";
  ctx.fillText(text, cx, cy);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

interface Props {
  regions: RegionRecord[];
  zoomT: number;
}

// Map (text length) → sprite world width so longer words don't crowd. All
// labels share the same texture aspect (1024×256 = 4:1), so the sprite y
// scale is x scale / 4.
function spriteWidthForLabel(label: string): number {
  // Sized in world units. Frustum is 1.5 wide at zoom=1, so 0.22 world
  // units ≈ 200px on a 1360-wide canvas — comfortable read.
  const base = 0.16;
  const extra = Math.min(0.16, label.length * 0.016);
  return base + extra;
}

export function RegionLabels({ regions, zoomT }: Props) {
  const sliderT = useMapStore((s) => s.sliderT);

  const sprites = useMemo(() => {
    return regions.map((region) => {
      const texture = makeLabelTexture(region.label);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      const w = spriteWidthForLabel(region.label);
      // 1024:256 = 4:1 aspect
      sprite.scale.set(w, w / 4, 1);
      sprite.renderOrder = -50;
      return { sprite, region };
    });
  }, [regions]);


  useFrame(() => {
    // Labels are most assertive at far zoom (when you're reading the
    // genre regions) and fade out as you zoom into the album covers.
    // - zoomT∈[0.0, 0.55]: opacity = 1
    // - zoomT∈[0.55, 0.85]: fade to 0
    // - zoomT > 0.85: hidden
    let opacity: number;
    if (zoomT < 0.55) {
      opacity = 1;
    } else if (zoomT < 0.85) {
      opacity = 1 - (zoomT - 0.55) / 0.3;
    } else {
      opacity = 0;
    }

    for (const { sprite, region } of sprites) {
      const a = region.stops.audio.centroid;
      const b = region.stops.balanced.centroid;
      const m = region.stops.mood.centroid;
      let x: number, y: number;
      if (sliderT <= 0.5) {
        const t = sliderT * 2;
        x = a[0] + (b[0] - a[0]) * t;
        y = a[1] + (b[1] - a[1]) * t;
      } else {
        const t = (sliderT - 0.5) * 2;
        x = b[0] + (m[0] - b[0]) * t;
        y = b[1] + (m[1] - b[1]) * t;
      }
      // z slightly above background but below the album points — they sort
      // by renderOrder, not z, so this is mostly cosmetic.
      sprite.position.set(x, y, 0.5);
      (sprite.material as THREE.SpriteMaterial).opacity = opacity;
      sprite.visible = opacity > 0.01;
    }
  });

  return (
    <>
      {sprites.map(({ sprite }, i) => (
        <primitive key={i} object={sprite} />
      ))}
    </>
  );
}

// Re-export for tree-shaking; unused type
export type RegionLabelStop = SliderStopId;
