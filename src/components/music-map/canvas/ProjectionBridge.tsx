"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function ProjectionBridge() {
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    function onRequest(e: Event) {
      const detail = (e as CustomEvent).detail as { worldXY: [number, number] };
      const v = new THREE.Vector3(detail.worldXY[0], detail.worldXY[1], 0);
      v.project(camera);
      const rect = canvas.getBoundingClientRect();
      const screenX = (v.x * 0.5 + 0.5) * rect.width;
      const screenY = (-v.y * 0.5 + 0.5) * rect.height;
      canvas.dispatchEvent(
        new CustomEvent("music-map:project-result", {
          detail: { screenX, screenY },
        }),
      );
    }
    canvas.addEventListener("music-map:request-project", onRequest as EventListener);
    return () =>
      canvas.removeEventListener("music-map:request-project", onRequest as EventListener);
  }, [camera, gl]);

  return null;
}
