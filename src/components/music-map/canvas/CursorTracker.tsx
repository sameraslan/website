"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { nearestWithin } from "../state/hitTest";
import { useMapStore } from "../state/store";

/** 14 CSS px hover radius (spec 4.4.3), converted to world units per-move. */
const HOVER_RADIUS_CSS_PX = 14;
/** Tooltip shows 80ms after the hover target settles (spec 4.4.3/4.4.7). */
const HOVER_TOOLTIP_DELAY_MS = 80;

export function CursorTracker({
  cursorRef,
  hoverRef,
  positionsRef,
}: {
  cursorRef: React.MutableRefObject<[number, number] | null>;
  /** -1 = no hover target. Written at most once per pointermove. */
  hoverRef: React.MutableRefObject<number>;
  /** Flat [x0,y0,x1,y1,...] interpolated positions, owned by AlbumField. */
  positionsRef: React.MutableRefObject<Float32Array>;
}) {
  const { gl, camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    // Debounces the tooltip's 80ms hover-in delay; cleared whenever the
    // hover target changes before it fires. Hover state itself (hoverRef,
    // canvas.style.cursor) updates immediately on every pointermove — only
    // the tooltip's appearance is delayed.
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    function clearHoverTimer() {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const cam = camera as THREE.OrthographicCamera;
      const worldX = (ndcX / cam.zoom) * (cam.right - cam.left) / 2 + cam.position.x;
      const worldY = (ndcY / cam.zoom) * (cam.top - cam.bottom) / 2 + cam.position.y;
      cursorRef.current = [worldX, worldY];

      const radiusWorld =
        HOVER_RADIUS_CSS_PX / ((cam.zoom * rect.height) / (cam.top - cam.bottom));
      const n = positionsRef.current.length / 2;
      const idx = nearestWithin(positionsRef.current, n, worldX, worldY, radiusWorld);
      canvas.style.cursor = idx >= 0 ? "pointer" : "";

      if (idx !== hoverRef.current) {
        hoverRef.current = idx;
        clearHoverTimer();
        if (idx >= 0) {
          const data = useMapStore.getState().data;
          const id = data?.positions[idx]?.id ?? null;
          hoverTimer = setTimeout(() => {
            hoverTimer = null;
            useMapStore.getState().setHoveredId(id);
            invalidate();
          }, HOVER_TOOLTIP_DELAY_MS);
        } else {
          useMapStore.getState().setHoveredId(null);
        }
      }

      invalidate();
    }
    function onLeave() {
      cursorRef.current = null;
      if (hoverRef.current !== -1) {
        hoverRef.current = -1;
        clearHoverTimer();
        useMapStore.getState().setHoveredId(null);
      }
      canvas.style.cursor = "";
      invalidate();
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      clearHoverTimer();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera, cursorRef, hoverRef, positionsRef, invalidate]);

  return null;
}
