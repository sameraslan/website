"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { RegionRecord } from "../data/types";
import { getRegionLabelEl } from "../state/regionLabelEls";

// Mirrors CameraRig's zoom range (see canvas/CameraRig.tsx) so zoomT here
// matches the u_zoomT the shader uses.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

// Labels sit 14 CSS px below the centroid so they don't cover the densest
// dots at that region's core (spec 4.3 / task-8 brief).
const LABEL_OFFSET_Y_PX = 14;

interface RegionLabelsProps {
  regions: RegionRecord[];
  /**
   * Flat [x0,y0,...] per-cluster mean positions at the current sliderT,
   * owned and recomputed by AlbumField (see centroidsRef there). Indexed by
   * region.clusterId, matching regions.json's cluster ordering.
   */
  centroidsRef: React.MutableRefObject<Float32Array>;
  /** Real camera.zoom (0.5..5), written every frame by CameraRig. */
  zoomRef: React.MutableRefObject<number>;
}

/**
 * Lives inside the canvas tree, mounted by Scene.tsx alongside TooltipDriver.
 * Every rendered frame it projects each region's current centroid with
 * camera.project, converts to CSS px using a cached canvas rect, and writes
 * style.transform/opacity directly onto the region's DOM <span> (rendered by
 * overlays/RegionLabels.tsx, registered via state/regionLabelEls.ts). No
 * React state, no per-frame re-render.
 */
export function RegionLabels({ regions, centroidsRef, zoomRef }: RegionLabelsProps) {
  const { camera, gl } = useThree();
  const rectRef = useRef<DOMRect | null>(null);
  const vecRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const canvas = gl.domElement;
    function updateRect() {
      rectRef.current = canvas.getBoundingClientRect();
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [gl]);

  useFrame(() => {
    const rect = rectRef.current;
    const centroids = centroidsRef.current;

    const zoomT = Math.max(0, Math.min(1, (zoomRef.current - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
    // clamp(1 - (zoomT - 0.50) / 0.12, 0, 1): fully visible at the initial
    // framing (zoomT 0.42) and below, faded to 0 by zoomT 0.62 (zoom ~3.3),
    // just before the shader's disc-to-cover crossfade starts reading as
    // covers (controller-inspection fix, task 8 round 1).
    let opacity = 1 - (zoomT - 0.5) / 0.12;
    if (opacity < 0) opacity = 0;
    if (opacity > 1) opacity = 1;

    for (const region of regions) {
      const el = getRegionLabelEl(region.clusterId);
      if (!el) continue;

      const cx = centroids[region.clusterId * 2];
      const cy = centroids[region.clusterId * 2 + 1];
      const hasCentroid =
        centroids.length > region.clusterId * 2 + 1 && !Number.isNaN(cx) && !Number.isNaN(cy);

      if (!rect || !hasCentroid || opacity <= 0) {
        el.style.opacity = "0";
        continue;
      }

      const v = vecRef.current;
      v.set(cx, cy, 0);
      v.project(camera);
      const screenX = (v.x * 0.5 + 0.5) * rect.width;
      const screenY = (-v.y * 0.5 + 0.5) * rect.height + LABEL_OFFSET_Y_PX;

      el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;
      el.style.opacity = String(opacity);
    }
  });

  return null;
}
