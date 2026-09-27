"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { nudgeVector, viewportWorldRect, visibleFractionThreshold } from "../state/bounds";
import { useMapStore } from "../state/store";
import { getOverviewFraming, isFramed } from "../state/view";

// How hard to pull the camera back toward the album box each frame. Soft so a
// manual over-pan eases back in instead of snapping, and so ambient drift sits
// gently against the boundary rather than juddering.
const EASE = 0.1;
// A touch of fringe past the trimmed cluster edge so edge albums aren't jammed
// against the viewport border.
const MARGIN = 0.04;
// Leave manual pan/zoom + its inertia alone for a moment before reclaiming
// bounds, and never act at all while a drag is actively in progress.
const RELEASE_MS = 500;
// Below this squared distance the correction is treated as settled; stop
// invalidating so frameloop="demand" can go idle.
const SETTLE_DIST_SQ = 1e-10;

/**
 * Keeps the *automatic* camera (ambient drift / settle) from wandering
 * entirely off the main mass of albums. Viewport-aware: computes the visible
 * viewport in the same world units as the camera's own frustum
 * (`viewportWorldRect`, see state/bounds.ts) and only corrects when the album
 * cloud's bounding box is mostly out of view (under 60% of it visible at or
 * below the fitted zoom, under 25% when zoomed in past it; see
 * `visibleFractionThreshold`) rather than clamping the camera into the box on
 * every frame. A user who zooms out to see the whole cloud, or pans to an
 * edge region while most of the cloud stays in view, is never yanked back.
 *
 * Only acts while the map is idle, no drag is in progress, and the user
 * hasn't grabbed the camera (drag or wheel) recently: manual panning,
 * zooming, and click-to-focus fly-tos are left untouched. Mount LAST in the
 * scene so this runs after ambient drift has moved the camera this frame.
 */
export function CameraBounds() {
  const invalidate = useThree((s) => s.invalidate);
  const stateRef = useRef({
    mode: useMapStore.getState().mode,
    lastInteraction: useMapStore.getState().lastInteraction,
    lastCameraGrab: useMapStore.getState().lastCameraGrab,
    dragging: useMapStore.getState().dragging,
  });
  useEffect(() => {
    // frameloop="demand": once a drag, wheel or release settles, nothing
    // renders again until the next input (and drift no longer runs under a
    // resting mouse), so the gates below would never be re-checked. Wake
    // one frame just after RELEASE_MS whenever a gate input changes.
    let wake: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useMapStore.subscribe((s) => {
      const prev = stateRef.current;
      const changed =
        prev.mode !== s.mode ||
        prev.lastInteraction !== s.lastInteraction ||
        prev.lastCameraGrab !== s.lastCameraGrab ||
        prev.dragging !== s.dragging;
      prev.mode = s.mode;
      prev.lastInteraction = s.lastInteraction;
      prev.lastCameraGrab = s.lastCameraGrab;
      prev.dragging = s.dragging;
      if (!changed) return;
      if (wake !== null) clearTimeout(wake);
      wake = setTimeout(() => {
        wake = null;
        invalidate();
      }, RELEASE_MS + 20);
    });
    return () => {
      unsubscribe();
      if (wake !== null) clearTimeout(wake);
    };
  }, [invalidate]);

  useFrame((state) => {
    const data = useMapStore.getState().data;
    if (!data || data.positions.length === 0) return;
    // Never nudge before InitialFrame has applied the fit snap for this data.
    if (!isFramed()) return;

    const { mode, lastInteraction, lastCameraGrab, dragging } = stateRef.current;
    // Only constrain the ambient/idle camera. Focus fly-tos (mode "focus"),
    // an active drag, and any recent camera grab (drag or wheel) own the
    // camera while they run/settle.
    if (mode !== "idle") return;
    if (dragging) return;
    const now = Date.now();
    if (now - lastInteraction < RELEASE_MS) return;
    if (now - lastCameraGrab < RELEASE_MS) return;

    const cam = state.camera as THREE.OrthographicCamera;
    const viewport = viewportWorldRect(cam);
    // The same percentile bounds the overview framing fits to (published by
    // InitialFrame, recomputed on every sliderT change), so the idle nudge
    // keeps the bulk of the cloud on screen, not its outliers.
    const framing = getOverviewFraming();
    const cloud = framing.bounds;
    // Stricter at or below the fitted zoom (60% of the cloud's box must be
    // in view) than when zoomed in past it (25%): see
    // visibleFractionThreshold in state/bounds.ts.
    const nudge = nudgeVector(
      { x: cam.position.x, y: cam.position.y },
      viewport,
      cloud,
      MARGIN,
      visibleFractionThreshold(cam.zoom, framing.zoom),
    );
    if (!nudge) return;

    const dx = nudge.x * EASE;
    const dy = nudge.y * EASE;
    if (dx * dx + dy * dy < SETTLE_DIST_SQ) return;
    cam.position.x += dx;
    cam.position.y += dy;
    // Still correcting: keep the demand loop alive until it settles.
    invalidate();
  });

  return null;
}
