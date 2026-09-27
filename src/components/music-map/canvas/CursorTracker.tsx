"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { nearestWithin } from "../state/hitTest";
import { useMapStore } from "../state/store";

/** 14 CSS px hover radius (spec 4.4.3), converted to world units per-move. */
const HOVER_RADIUS_CSS_PX = 14;
/** Tooltip shows 80ms after the hover target settles (spec 4.4.3/4.4.7). */
const HOVER_TOOLTIP_DELAY_MS = 80;

/**
 * Converts a client (viewport) point to world coordinates under the given
 * orthographic camera and canvas rect. Shared by CursorTracker's hover
 * tracking, CameraRig's zoom-anchor point, and state/debug.ts's
 * `getWorldAt` test hook, so there is exactly one screen-to-world formula.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  camera: THREE.OrthographicCamera,
): [number, number] {
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const worldX = (ndcX / camera.zoom) * (camera.right - camera.left) / 2 + camera.position.x;
  const worldY = (ndcY / camera.zoom) * (camera.top - camera.bottom) / 2 + camera.position.y;
  return [worldX, worldY];
}

export function CursorTracker({
  cursorRef,
  hoverRef,
  positionsRef,
}: {
  cursorRef: React.MutableRefObject<[number, number] | null>;
  /** -1 = no hover target. Written at most once per rendered frame. */
  hoverRef: React.MutableRefObject<number>;
  /** Flat [x0,y0,x1,y1,...] interpolated positions, owned by AlbumField. */
  positionsRef: React.MutableRefObject<Float32Array>;
}) {
  const { gl, camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  // Debounces the tooltip's 80ms hover-in delay; cleared whenever the hover
  // target changes before it fires. A ref (not a local var in the effect)
  // because it's read and cleared from both the pointer-event effect (on
  // unmount) and the useFrame hit-test gate below.
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearHoverTimer() {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  useEffect(() => {
    const canvas = gl.domElement;
    // Only records the latest pointer position here; the actual hit test
    // (an O(n) scan) runs at most once per rendered frame in the useFrame
    // below (spec 4.4.3), not once per pointermove event. Multiple moves
    // between frames collapse into a single hit test against the latest
    // position, same as browser event coalescing would give us, but
    // guaranteed rather than relied upon.
    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const cam = camera as THREE.OrthographicCamera;
      cursorRef.current = screenToWorld(e.clientX, e.clientY, rect, cam);
      invalidate();
    }
    function onLeave() {
      cursorRef.current = null;
      invalidate();
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera, cursorRef, invalidate]);

  useEffect(() => clearHoverTimer, []);

  // The actual hit test: runs once per rendered frame (frameloop="demand"
  // means this only fires when something invalidated, e.g. the pointermove
  // handler above), never once per pointer event.
  useFrame(() => {
    const canvas = gl.domElement;
    const c = cursorRef.current;

    if (!c) {
      if (hoverRef.current !== -1) {
        hoverRef.current = -1;
        clearHoverTimer();
        useMapStore.getState().setHoveredId(null);
      }
      canvas.style.cursor = "";
      return;
    }

    const cam = camera as THREE.OrthographicCamera;
    const rect = canvas.getBoundingClientRect();
    const radiusWorld =
      HOVER_RADIUS_CSS_PX / ((cam.zoom * rect.height) / (cam.top - cam.bottom));
    const n = positionsRef.current.length / 2;
    const idx = nearestWithin(positionsRef.current, n, c[0], c[1], radiusWorld);
    canvas.style.cursor = idx >= 0 ? "pointer" : "";

    if (idx !== hoverRef.current) {
      hoverRef.current = idx;
      clearHoverTimer();
      if (idx >= 0) {
        const data = useMapStore.getState().data;
        const id = data?.positions[idx]?.id ?? null;
        hoverTimerRef.current = setTimeout(() => {
          hoverTimerRef.current = null;
          useMapStore.getState().setHoveredId(id);
          invalidate();
        }, HOVER_TOOLTIP_DELAY_MS);
      } else {
        useMapStore.getState().setHoveredId(null);
      }
    }
  });

  return null;
}
