"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function CursorTracker({
  onWorld,
}: {
  onWorld: (xy: [number, number] | null) => void;
}) {
  const { gl, camera } = useThree();
  const lastWorld = useRef<[number, number] | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;
    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const cam = camera as THREE.OrthographicCamera;
      const worldX = (ndcX / cam.zoom) * (cam.right - cam.left) / 2 + cam.position.x;
      const worldY = (ndcY / cam.zoom) * (cam.top - cam.bottom) / 2 + cam.position.y;
      lastWorld.current = [worldX, worldY];
      onWorld([worldX, worldY]);
    }
    function onLeave() {
      lastWorld.current = null;
      onWorld(null);
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera, onWorld]);

  return null;
}
