"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";

const MIN_ZOOM = 0.5;
// Capped at 5 so a high-DPR viewport stays under the ~256 GL_POINTS sprite
// limit (see album.ts gl_PointSize clamp). 5x lets you read a single cover
// without losing the focused dot.
const MAX_ZOOM = 5.0;
const PAN_SENSITIVITY = 0.0025;
const ZOOM_SENSITIVITY = 0.0015;
const FRICTION = 0.92;
// Below this squared speed (world units/frame, squared) inertia is treated as
// settled: stop nudging the camera and stop re-invalidating every frame, or
// frameloop="demand" would never go idle after a pan.
const VELOCITY_EPSILON_SQ = 1e-10;

export function CameraRig({ zoomRef }: { zoomRef: React.MutableRefObject<number> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
      velocity.current = { x: 0, y: 0 };
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
      camera.position.x -= dx * scale;
      camera.position.y += dy * scale;
      velocity.current = { x: -dx * scale, y: dy * scale };
      invalidate();
    };
    const onUp = () => {
      dragging.current = false;
      lastPointer.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      registerInteraction();
      registerCameraGrab();
      const factor = 1 - e.deltaY * ZOOM_SENSITIVITY;
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
      camera.updateProjectionMatrix();
      invalidate();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl, registerInteraction, registerCameraGrab, invalidate]);

  useFrame(() => {
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
    zoomRef.current = camera.zoom;
  });

  return null;
}
