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

export function CameraRig({ onZoomT }: { onZoomT?: (t: number) => void }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastZoomT = useRef(-1);

  const registerInteraction = useMapStore((s) => s.registerInteraction);

  useEffect(() => {
    const canvas = gl.domElement;

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      registerInteraction();
    };
    const onMove = (e: PointerEvent) => {
      registerInteraction();
      if (!dragging.current || !lastPointer.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      const scale = PAN_SENSITIVITY / camera.zoom;
      camera.position.x -= dx * scale;
      camera.position.y += dy * scale;
      velocity.current = { x: -dx * scale, y: dy * scale };
    };
    const onUp = () => {
      dragging.current = false;
      lastPointer.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      registerInteraction();
      const factor = 1 - e.deltaY * ZOOM_SENSITIVITY;
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
      camera.updateProjectionMatrix();
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
  }, [camera, gl, registerInteraction]);

  useFrame(() => {
    if (!dragging.current) {
      camera.position.x += velocity.current.x;
      camera.position.y += velocity.current.y;
      velocity.current.x *= FRICTION;
      velocity.current.y *= FRICTION;
    }
    if (onZoomT) {
      const t = Math.max(0, Math.min(1, (camera.zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
      if (Math.abs(t - lastZoomT.current) > 0.0001) {
        lastZoomT.current = t;
        onZoomT(t);
      }
    }
  });

  return null;
}
