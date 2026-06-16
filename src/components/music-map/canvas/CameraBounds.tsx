"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { getMainBounds } from "../state/bounds";
import { useMapStore } from "../state/store";

// How hard to pull the camera back toward the album box each frame. Soft so a
// manual over-pan eases back in instead of snapping, and so ambient drift sits
// gently against the boundary rather than juddering.
const EASE = 0.1;
// A touch of fringe past the trimmed cluster edge so edge albums aren't jammed
// against the viewport border.
const MARGIN = 0.04;
// Leave manual pan + its inertia alone for a moment before reclaiming bounds.
const RELEASE_MS = 500;

/**
 * Keeps the *automatic* camera (ambient drift / settle) within the main mass
 * of albums so it never wanders into empty space. Viewport-aware: it clamps so
 * the visible frame stays inside the album box, not just the camera center.
 *
 * Only acts while the map is idle and the user hasn't interacted recently —
 * manual panning and click-to-focus fly-tos are left untouched. Mount LAST in
 * the scene so this runs after drift/tour have moved the camera this frame.
 */
export function CameraBounds() {
  const stateRef = useRef({
    mode: useMapStore.getState().mode,
    lastInteraction: useMapStore.getState().lastInteraction,
    sliderT: useMapStore.getState().sliderT,
  });
  useEffect(
    () =>
      useMapStore.subscribe((s) => {
        stateRef.current.mode = s.mode;
        stateRef.current.lastInteraction = s.lastInteraction;
        stateRef.current.sliderT = s.sliderT;
      }),
    [],
  );

  useFrame((state) => {
    const data = useMapStore.getState().data;
    if (!data || data.positions.length === 0) return;

    const { mode, lastInteraction, sliderT } = stateRef.current;
    // Only constrain the ambient/idle camera. Focus fly-tos (mode "focus") and
    // active manual panning own the camera while they run.
    if (mode !== "idle") return;
    if (Date.now() - lastInteraction < RELEASE_MS) return;

    const cam = state.camera as THREE.OrthographicCamera;
    const vp = state.viewport.getCurrentViewport(cam, [0, 0, 0]);
    const halfW = vp.width / 2;
    const halfH = vp.height / 2;
    const b = getMainBounds(data, sliderT);

    // Keep the visible viewport inside the album box. When the box is smaller
    // than the viewport (zoomed far out) the range inverts — fall back to
    // centering on the box midpoint.
    let loX = b.minX - MARGIN + halfW;
    let hiX = b.maxX + MARGIN - halfW;
    if (loX > hiX) loX = hiX = (b.minX + b.maxX) / 2;
    let loY = b.minY - MARGIN + halfH;
    let hiY = b.maxY + MARGIN - halfH;
    if (loY > hiY) loY = hiY = (b.minY + b.maxY) / 2;

    const tx = Math.max(loX, Math.min(hiX, cam.position.x));
    const ty = Math.max(loY, Math.min(hiY, cam.position.y));
    cam.position.x += (tx - cam.position.x) * EASE;
    cam.position.y += (ty - cam.position.y) * EASE;
  });

  return null;
}
