"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function CursorTracker({
  cursorRef,
}: {
  cursorRef: React.MutableRefObject<[number, number] | null>;
}) {
  const { gl, camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const cam = camera as THREE.OrthographicCamera;
      const worldX = (ndcX / cam.zoom) * (cam.right - cam.left) / 2 + cam.position.x;
      const worldY = (ndcY / cam.zoom) * (cam.top - cam.bottom) / 2 + cam.position.y;
      cursorRef.current = [worldX, worldY];
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

  return null;
}
