"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { registerDebug } from "../state/debug";
import { cssPxToWorld, MOUSE_HIT_RADIUS_CSS_PX, nearestWithin } from "../state/hitTest";
import { useMapStore } from "../state/store";

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

/**
 * World position under a canvas-relative CSS px point (what `cursorRef`
 * stores), through the camera as it is right now. Converting at read time
 * rather than at pointermove time keeps hover, the cursor-pull uniform and
 * the pointer cursor correct after the camera moves under a resting mouse
 * (fly-to, drift, bounds nudges, pinch).
 */
export function cursorToWorld(
  cursorPx: [number, number],
  size: { width: number; height: number },
  camera: THREE.OrthographicCamera,
): [number, number] {
  return screenToWorld(
    cursorPx[0],
    cursorPx[1],
    { left: 0, top: 0, width: size.width, height: size.height },
    camera,
  );
}

export function CursorTracker({
  cursorRef,
  hoverRef,
  positionsRef,
}: {
  /** Canvas-relative CSS px of the mouse, or null when it is off the canvas. */
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
      // Hover has no meaning on touch: there is no "cursor" resting over a
      // point between touches, and a finger is always covering whatever it
      // could hover, so a touch pointermove (drag/pinch) must never arm the
      // hover ring or the 80ms tooltip timer (spec 4.7 / Task 11 item 3).
      if (e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      cursorRef.current = [e.clientX - rect.left, e.clientY - rect.top];
      invalidate();
    }
    function onLeave(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      cursorRef.current = null;
      invalidate();
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, cursorRef, invalidate]);

  useEffect(() => clearHoverTimer, []);

  // Dev-only: hover state and a ground-truth hit test at any client point,
  // so Playwright can check hover agrees with the album actually under the
  // mouse after the camera moves (fly-to, drift, bounds nudge, pinch).
  useEffect(() => {
    registerDebug({
      getHoverIndex: () => hoverRef.current,
      getAlbumAt: (clientX, clientY) => {
        const canvas = gl.domElement;
        const rect = canvas.getBoundingClientRect();
        const cam = camera as THREE.OrthographicCamera;
        const [wx, wy] = screenToWorld(clientX, clientY, rect, cam);
        const positions = positionsRef.current;
        const n = positions.length / 2;
        const nearest = nearestWithin(positions, n, wx, wy, Infinity);
        const pxPerWorld = (cam.zoom * rect.height) / (cam.top - cam.bottom);
        const distPx =
          nearest < 0
            ? Infinity
            : Math.hypot(positions[nearest * 2] - wx, positions[nearest * 2 + 1] - wy) *
              pxPerWorld;
        // Screen (client) position of the nearest album, inverse of
        // screenToWorld, so a harness can aim at a real disc.
        const screen =
          nearest < 0
            ? null
            : {
                x:
                  rect.left +
                  (((positions[nearest * 2] - cam.position.x) * cam.zoom) /
                    ((cam.right - cam.left) / 2) +
                    1) *
                    (rect.width / 2),
                y:
                  rect.top +
                  (1 -
                    ((positions[nearest * 2 + 1] - cam.position.y) * cam.zoom) /
                      ((cam.top - cam.bottom) / 2)) *
                    (rect.height / 2),
              };
        return {
          index: distPx < MOUSE_HIT_RADIUS_CSS_PX ? nearest : -1,
          nearest,
          distPx,
          screen,
        };
      },
    });
    return () => {
      if (typeof window !== "undefined" && window.__mapDebug) {
        delete window.__mapDebug.getHoverIndex;
        delete window.__mapDebug.getAlbumAt;
      }
    };
  }, [gl, camera, hoverRef, positionsRef]);

  // The actual hit test: runs once per rendered frame (frameloop="demand"
  // means this only fires when something invalidated, e.g. the pointermove
  // handler above), never once per pointer event. Every camera animation
  // (fly-to, drift, bounds nudge, pinch) also renders frames, and the
  // cursor is re-projected through the live camera on each of them, so the
  // hover target follows whatever is under a resting mouse.
  // eslint-disable-next-line react-hooks/immutability -- this per-frame callback sets canvas.style.cursor directly on the R3F canvas DOM node (see below); a plain DOM style write is cheaper than routing cursor state through React here and matches the rest of this hot path's ref-based, non-React-render pattern.
  useFrame((state) => {
    const canvas = gl.domElement;
    const c = cursorRef.current;

    if (!c) {
      if (hoverRef.current !== -1) {
        hoverRef.current = -1;
        clearHoverTimer();
        useMapStore.getState().setHoveredId(null);
      }
      // eslint-disable-next-line react-hooks/immutability -- see the useFrame-level comment above.
      canvas.style.cursor = "";
      return;
    }

    const cam = camera as THREE.OrthographicCamera;
    const [wx, wy] = cursorToWorld(c, state.size, cam);
    const radiusWorld = cssPxToWorld(
      MOUSE_HIT_RADIUS_CSS_PX,
      state.size.height,
      cam.zoom,
      cam.top - cam.bottom,
    );
    const n = positionsRef.current.length / 2;
    const idx = nearestWithin(positionsRef.current, n, wx, wy, radiusWorld);
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
