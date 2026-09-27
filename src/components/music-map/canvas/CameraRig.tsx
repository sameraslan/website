"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";
import { anchoredZoom } from "../state/zoomMath";
import { screenToWorld } from "./CursorTracker";

const MIN_ZOOM = 0.5;
// Capped at 5 so a high-DPR viewport stays under the ~256 GL_POINTS sprite
// limit (see album.ts gl_PointSize clamp). 5x lets you read a single cover
// without losing the focused dot.
const MAX_ZOOM = 5.0;
const PAN_SENSITIVITY = 0.0025;
// Trackpad pinch (ctrlKey) uses half the sensitivity of a mouse wheel notch
// (spec 4.4.4).
const WHEEL_SENSITIVITY = 0.0015;
const PINCH_SENSITIVITY = 0.00075;
// Exponential time constant (seconds) the frame loop uses to approach
// targetZoom (spec 4.4.4).
const ZOOM_TIME_CONSTANT_S = 0.09;
// Below this the smoothed zoom is treated as settled: snap to the exact
// target and stop invalidating, or frameloop="demand" would never go idle.
const ZOOM_SETTLE_EPSILON = 1e-4;
const FRICTION = 0.92;
// Below this squared speed (world units/frame, squared) inertia is treated as
// settled: stop nudging the camera and stop re-invalidating every frame, or
// frameloop="demand" would never go idle after a pan.
const VELOCITY_EPSILON_SQ = 1e-10;
// Fling velocity averages the last 3 move deltas (spec 4.4.5).
const VELOCITY_HISTORY_LEN = 3;

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function CameraRig({ zoomRef }: { zoomRef: React.MutableRefObject<number> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const pointerId = useRef<number | null>(null);
  const velocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Last few move deltas (world units, already scaled), newest last. Averaged
  // on release into the fling velocity, so a single jittery final move can't
  // dominate the fling.
  const moveHistory = useRef<{ x: number; y: number }[]>([]);

  // Target zoom the frame loop eases camera.zoom toward. Kept in sync with
  // camera.zoom whenever no wheel gesture is in flight, so it never fights
  // FlyToFocus's direct camera.zoom writes during a glide.
  const targetZoom = useRef(camera.zoom);
  const zooming = useRef(false);
  // World point under the cursor at the most recent wheel event; held fixed
  // on screen while the smoothed zoom eases toward targetZoom.
  const zoomAnchor = useRef<[number, number] | null>(null);

  const registerInteraction = useMapStore((s) => s.registerInteraction);
  const registerCameraGrab = useMapStore((s) => s.registerCameraGrab);

  useEffect(() => {
    const canvas = gl.domElement;
    // Tracks whether the current drag has moved yet, so the grab is only
    // registered once the pointer actually moves with the button down,
    // matching "pointerdown-drag" rather than every click.
    let dragMoved = false;

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      dragMoved = false;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      pointerId.current = e.pointerId;
      velocity.current = { x: 0, y: 0 };
      moveHistory.current = [];
      // Captures the pointer to the canvas so drag events keep arriving even
      // once the pointer leaves the canvas bounds (spec 4.4.5); released on
      // pointerup/pointercancel below.
      canvas.setPointerCapture(e.pointerId);
      registerInteraction();
      registerCameraGrab();
    };
    const onMove = (e: PointerEvent) => {
      registerInteraction();
      if (!dragging.current || !lastPointer.current) return;
      if (!dragMoved) {
        dragMoved = true;
        registerCameraGrab();
      }
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      const scale = PAN_SENSITIVITY / camera.zoom;
      const wdx = -dx * scale;
      const wdy = dy * scale;
      camera.position.x += wdx;
      camera.position.y += wdy;
      moveHistory.current.push({ x: wdx, y: wdy });
      if (moveHistory.current.length > VELOCITY_HISTORY_LEN) {
        moveHistory.current.shift();
      }
      invalidate();
    };
    const endDrag = () => {
      dragging.current = false;
      lastPointer.current = null;
      if (pointerId.current !== null && canvas.hasPointerCapture(pointerId.current)) {
        canvas.releasePointerCapture(pointerId.current);
      }
      pointerId.current = null;
      const hist = moveHistory.current;
      if (hist.length > 0) {
        let sx = 0;
        let sy = 0;
        for (const v of hist) {
          sx += v.x;
          sy += v.y;
        }
        velocity.current = { x: sx / hist.length, y: sy / hist.length };
      }
      moveHistory.current = [];
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      registerInteraction();
      registerCameraGrab();
      const sensitivity = e.ctrlKey ? PINCH_SENSITIVITY : WHEEL_SENSITIVITY;
      const factor = 1 - e.deltaY * sensitivity;
      const base = zooming.current ? targetZoom.current : camera.zoom;
      targetZoom.current = clampZoom(base * factor);
      const rect = canvas.getBoundingClientRect();
      zoomAnchor.current = screenToWorld(e.clientX, e.clientY, rect, camera);
      zooming.current = true;
      invalidate();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", endDrag);
    // pointerleave no longer ends the drag: setPointerCapture keeps move/up
    // events targeting the canvas even once the cursor leaves it. Only a real
    // pointercancel (e.g. the OS taking over the gesture) ends it early.
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl, registerInteraction, registerCameraGrab, invalidate]);

  useFrame((_state, delta) => {
    if (!dragging.current) {
      const speedSq = velocity.current.x * velocity.current.x + velocity.current.y * velocity.current.y;
      if (speedSq > VELOCITY_EPSILON_SQ) {
        camera.position.x += velocity.current.x;
        camera.position.y += velocity.current.y;
        velocity.current.x *= FRICTION;
        velocity.current.y *= FRICTION;
        // Inertia still has visible speed: keep the demand loop alive for
        // another frame.
        invalidate();
      } else {
        velocity.current.x = 0;
        velocity.current.y = 0;
      }
    }

    if (zooming.current) {
      const prevZoom = camera.zoom;
      const prevX = camera.position.x;
      const prevY = camera.position.y;
      const diff = targetZoom.current - prevZoom;
      let nextZoom = prevZoom + diff * (1 - Math.exp(-delta / ZOOM_TIME_CONSTANT_S));
      const settled = Math.abs(targetZoom.current - nextZoom) < ZOOM_SETTLE_EPSILON;
      if (settled) nextZoom = targetZoom.current;

      if (zoomAnchor.current) {
        const nextPos = anchoredZoom(
          { x: prevX, y: prevY, zoom: prevZoom },
          zoomAnchor.current,
          nextZoom,
        );
        camera.position.x = nextPos.x;
        camera.position.y = nextPos.y;
      }
      camera.zoom = nextZoom;
      camera.updateProjectionMatrix();

      if (settled) {
        zooming.current = false;
      } else {
        invalidate();
      }
    } else {
      // No wheel gesture in flight: keep targetZoom tracking the real zoom
      // (which FlyToFocus may be driving directly) so the next wheel event
      // starts from the current value instead of a stale target.
      targetZoom.current = camera.zoom;
    }

    zoomRef.current = camera.zoom;
  });

  return null;
}
