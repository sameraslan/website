"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { RegionRecord } from "../data/types";
import { getRegionLabelEl } from "../state/regionLabelEls";
import { getOverviewFraming } from "../state/view";

// Labels sit 14 CSS px below the centroid so they don't cover the densest
// dots at that region's core (spec 4.3 / task-8 brief).
const LABEL_OFFSET_Y_PX = 14;

// Regions with fewer members than this are hidden entirely: with the real
// dataset only 3 of 8 clusters are actually populated (1092 to 1635 members
// each); the rest have 1 to 3 albums and labeling them as a "region" is
// misleading (task 8 fix round 2).
const MIN_MEMBERS_FOR_LABEL = 40;

interface RegionLabelsProps {
  regions: RegionRecord[];
  /**
   * Flat [x0,y0,...] per-cluster mean positions at the current sliderT,
   * owned and recomputed by AlbumField (see centroidsRef there). Indexed by
   * region.clusterId, matching regions.json's cluster ordering.
   */
  centroidsRef: React.MutableRefObject<Float32Array>;
  /** Member count per clusterId, fixed per data load; owned by AlbumField. */
  clusterCountsRef: React.MutableRefObject<Uint32Array>;
  /** Real camera.zoom, written every frame by CameraRig. */
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
export function RegionLabels({
  regions,
  centroidsRef,
  clusterCountsRef,
  zoomRef,
}: RegionLabelsProps) {
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
    const counts = clusterCountsRef.current;
    const fitZoom = getOverviewFraming().zoom;

    // clamp(1 - (zoom/fitZoom - 1.6) / 0.5, 0, 1): fully visible at the
    // overview (zoom == fitZoom, ratio 1) and below, faded to 0 by 2.1x fit,
    // ahead of the shader's disc-to-cover crossfade (task 8 fix round 2;
    // replaces round 1's absolute-zoomT formula, which stopped matching once
    // the real fit zoom turned out much smaller than the old fixed 2.4).
    const ratio = zoomRef.current / Math.max(fitZoom, 0.0001);
    let opacity = 1 - (ratio - 1.6) / 0.5;
    if (opacity < 0) opacity = 0;
    if (opacity > 1) opacity = 1;

    for (const region of regions) {
      const el = getRegionLabelEl(region.clusterId);
      if (!el) continue;

      const cx = centroids[region.clusterId * 2];
      const cy = centroids[region.clusterId * 2 + 1];
      const hasCentroid =
        centroids.length > region.clusterId * 2 + 1 && !Number.isNaN(cx) && !Number.isNaN(cy);
      const hasEnoughMembers =
        counts.length > region.clusterId && counts[region.clusterId] >= MIN_MEMBERS_FOR_LABEL;

      if (!rect || !hasCentroid || !hasEnoughMembers || opacity <= 0) {
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
