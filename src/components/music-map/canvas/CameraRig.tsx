"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";
import { getOverviewFraming } from "../state/view";
import { anchoredZoom, pinchZoom } from "../state/zoomMath";
import { screenToWorld } from "./CursorTracker";

// Capped at 5 so a high-DPR viewport stays under the ~256 GL_POINTS sprite
// limit (see album.ts gl_PointSize clamp). 5x lets you read a single cover
// without losing the focused dot.
const MAX_ZOOM = 5.0;
// Fraction of the fitted overview zoom (state/view.ts) below which the user
// can't zoom out further: 0.8x fit still shows the whole cloud with room to
// spare, but doesn't let the camera wander out to where the cloud is a speck
// (task 8 fix round 2; replaces the old fixed MIN_ZOOM=0.5, which no longer
// means anything now the overview zoom itself varies with the dataset).
const MIN_ZOOM_FIT_MULTIPLE = 0.8;

/** Dynamic zoom-out floor: 0.8x the fitted overview zoom. fitZoom is already
 * clamped to [0.5, 5] (state/bounds.ts), so this never exceeds MAX_ZOOM. */
function getMinZoom(): number {
  return MIN_ZOOM_FIT_MULTIPLE * getOverviewFraming().zoom;
}
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
  return Math.max(getMinZoom(), Math.min(MAX_ZOOM, z));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function CameraRig({ zoomRef }: { zoomRef: React.MutableRefObject<number> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Last few move deltas (world units, already scaled), newest last. Averaged
  // on release into the fling velocity, so a single jittery final move can't
  // dominate the fling.
  const moveHistory = useRef<{ x: number; y: number }[]>([]);

  // All currently-down pointers, keyed by pointerId (screen px). Used to
  // detect a two-finger pinch: single-pointer pan is handled by the existing
  // dragging/lastPointer refs above, driven only while this map holds
  // exactly one entry.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchActive = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

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
  const setDragging = useMapStore((s) => s.setDragging);

  useEffect(() => {
    const canvas = gl.domElement;
    // Tracks whether the current drag has moved yet, so the grab is only
    // registered once the pointer actually moves with the button down,
    // matching "pointerdown-drag" rather than every click.
    let dragMoved = false;

    const onDown = (e: PointerEvent) => {
      // Captures the pointer to the canvas so drag/pinch events keep
      // arriving even once a finger leaves the canvas bounds (spec 4.4.5);
      // released per-pointer on pointerup/pointercancel below.
      canvas.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      registerInteraction();

      if (pointers.current.size === 1) {
        dragging.current = true;
        dragMoved = false;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        velocity.current = { x: 0, y: 0 };
        moveHistory.current = [];
        setDragging(true);
        registerCameraGrab();
      } else if (pointers.current.size === 2) {
        // A second finger arrived mid-gesture: this is now a pinch, not a
        // pan. Cancel any in-flight single-finger drag so it can't leave
        // stale velocity behind (no fling after a pinch, spec/Task 11
        // item 2), then start the pinch from the two current points.
        dragging.current = false;
        setDragging(false);
        lastPointer.current = null;
        velocity.current = { x: 0, y: 0 };
        moveHistory.current = [];
        const pts = Array.from(pointers.current.values());
        pinchStartDist.current = dist(pts[0], pts[1]);
        pinchStartZoom.current = camera.zoom;
        pinchActive.current = true;
        registerCameraGrab();
      }
      // A 3rd+ pointer is ignored: the existing pinch (or pan) continues
      // driven by whichever two/one pointers were already tracked.
    };
    const onMove = (e: PointerEvent) => {
      registerInteraction();
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinchActive.current && pointers.current.size === 2) {
        const pts = Array.from(pointers.current.values());
        const currDist = dist(pts[0], pts[1]);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const rect = canvas.getBoundingClientRect();
        const midWorld = screenToWorld(midX, midY, rect, camera);
        const rawZoom = pinchZoom(pinchStartDist.current, currDist, pinchStartZoom.current);
        const nextZoom = clampZoom(rawZoom);
        const nextPos = anchoredZoom(
          { x: camera.position.x, y: camera.position.y, zoom: camera.zoom },
          midWorld,
          nextZoom,
        );
        camera.position.x = nextPos.x;
        camera.position.y = nextPos.y;
        camera.zoom = nextZoom;
        camera.updateProjectionMatrix();
        invalidate();
        return;
      }

      if (!dragging.current || !lastPointer.current || pointers.current.size !== 1) return;
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
    const endDrag = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (pointers.current.size < 2) {
        // Pinch ends the moment fewer than two fingers remain.
        pinchActive.current = false;
      }

      if (pointers.current.size === 0) {
        dragging.current = false;
        setDragging(false);
        lastPointer.current = null;
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
      } else {
        // One finger remains after a pinch (or a 3rd+ pointer lifted): don't
        // resume a seamless pan from here, and don't fling — the remaining
        // finger's position vs. the lifted one would otherwise read as a
        // sudden jump. A fresh pointerdown starts a clean pan.
        dragging.current = false;
        setDragging(false);
        lastPointer.current = null;
        velocity.current = { x: 0, y: 0 };
        moveHistory.current = [];
      }
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
  }, [camera, gl, registerInteraction, registerCameraGrab, setDragging, invalidate]);

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
