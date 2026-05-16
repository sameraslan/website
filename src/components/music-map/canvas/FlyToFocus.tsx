"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { easeOutCubic, interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";

const FLY_DURATION_MS = 600;
const FOCUS_ZOOM = 3.0;

interface Animation {
  startMs: number;
  fromPos: THREE.Vector2;
  toPos: THREE.Vector2;
  fromZoom: number;
  toZoom: number;
  instant: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FlyToFocus() {
  const { camera } = useThree();
  const data = useMapStore((s) => s.data);
  const focusedId = useMapStore((s) => s.focusedId);
  const sliderT = useMapStore((s) => s.sliderT);
  const anim = useRef<Animation | null>(null);

  useEffect(() => {
    if (!data || !focusedId) return;
    const target = data.positions.find((p) => p.id === focusedId);
    if (!target) return;
    const [tx, ty] = interpolatePosition(target.audio, target.balanced, target.mood, sliderT);
    const cam = camera as THREE.OrthographicCamera;
    anim.current = {
      startMs: performance.now(),
      fromPos: new THREE.Vector2(cam.position.x, cam.position.y),
      toPos: new THREE.Vector2(tx, ty),
      fromZoom: cam.zoom,
      toZoom: FOCUS_ZOOM,
      instant: prefersReducedMotion(),
    };
  }, [focusedId, data, sliderT, camera]);

  useFrame(() => {
    if (!anim.current) return;
    const cam = camera as THREE.OrthographicCamera;
    const a = anim.current;
    if (a.instant) {
      cam.position.x = a.toPos.x;
      cam.position.y = a.toPos.y;
      cam.zoom = a.toZoom;
      cam.updateProjectionMatrix();
      anim.current = null;
      return;
    }
    const t = (performance.now() - a.startMs) / FLY_DURATION_MS;
    const k = easeOutCubic(t);
    cam.position.x = a.fromPos.x + (a.toPos.x - a.fromPos.x) * k;
    cam.position.y = a.fromPos.y + (a.toPos.y - a.fromPos.y) * k;
    cam.zoom = a.fromZoom + (a.toZoom - a.fromZoom) * k;
    cam.updateProjectionMatrix();
    if (t >= 1) anim.current = null;
  });

  return null;
}
