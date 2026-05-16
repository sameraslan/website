"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";

const IDLE_DELAY_MS = 5_000;
// 30s loop. Target frequency in cycles per second for the slowest harmonic.
const BASE_FREQ_HZ = 1 / 30;
// World-unit amplitude of the drift around the cluster centroid (0,0). The
// orthographic frustum is ~1.5 world units wide, so 0.08 ≈ 5% of view width
// at zoom=1 — a perceptible but unobtrusive sway.
const DRIFT_AMPLITUDE = 0.08;

function noise2D(x: number, y: number): number {
  // Cheap sine-based pseudo-noise. Three incommensurate sines keep the path
  // from looping audibly inside the 30s window.
  return (
    Math.sin(x * 1.13) * 0.5 +
    Math.sin(y * 0.87) * 0.3 +
    Math.sin(x * 0.41 + y * 0.59) * 0.2
  );
}

export function AmbientDrift() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const mountedAt = useRef(Date.now());
  const start = useRef(performance.now());
  const lastDrift = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Read store state via refs updated through a subscription so the high-
  // frequency `lastInteraction` and `mode` updates don't churn React.
  const stateRef = useRef({
    lastInteraction: useMapStore.getState().lastInteraction,
    mode: useMapStore.getState().mode,
  });
  useEffect(() => {
    return useMapStore.subscribe((s) => {
      stateRef.current.lastInteraction = s.lastInteraction;
      stateRef.current.mode = s.mode;
    });
  }, []);
  const reducedMotion = useReducedMotion();

  useFrame(() => {
    const perfNow = performance.now();
    const wallNow = Date.now();
    const t = (perfNow - start.current) / 1000;
    const phase = t * BASE_FREQ_HZ * 2.0 * Math.PI;
    const nx = noise2D(phase, phase * 0.73);
    const ny = noise2D(phase * 0.91 + 17.3, phase * 1.07 + 41.9);
    const targetX = nx * DRIFT_AMPLITUDE;
    const targetY = ny * DRIFT_AMPLITUDE;

    const { lastInteraction, mode } = stateRef.current;
    // Drift waits IDLE_DELAY_MS after the LATER of (a) mount and (b) the
    // last user interaction. The store initialises lastInteraction = 0
    // before any pointer event fires, so we use mount time as the floor
    // — otherwise drift would start immediately on page load and shift
    // the cluster before the user has a chance to see it at rest.
    const idleSince = Math.max(lastInteraction, mountedAt.current);
    const gated =
      reducedMotion || mode !== "idle" || wallNow - idleSince < IDLE_DELAY_MS;
    if (gated) {
      // Track the noise without applying — when drift resumes, the next
      // frame's delta stays small and we don't snap the camera.
      lastDrift.current.x = targetX;
      lastDrift.current.y = targetY;
      return;
    }

    // Apply the *delta* between this frame's drift target and the previous
    // frame's target. This way the drift sits on top of any pan / fly-to
    // motion done by other systems instead of fighting them.
    camera.position.x += targetX - lastDrift.current.x;
    camera.position.y += targetY - lastDrift.current.y;
    lastDrift.current.x = targetX;
    lastDrift.current.y = targetY;
  });

  return null;
}

function useReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
