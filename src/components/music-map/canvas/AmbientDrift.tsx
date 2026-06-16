"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { useTuningStore } from "../state/tuning";

function noise2D(x: number, y: number): number {
  return (
    Math.sin(x * 1.13) * 0.5 +
    Math.sin(y * 0.87) * 0.3 +
    Math.sin(x * 0.41 + y * 0.59) * 0.2
  );
}

export function AmbientDrift() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  // mountedAt seeds the idle gate. Leaving it at 0 means the initial-load
  // settle delay is skipped — drift begins the moment the map is `idle` (data
  // loaded) so the page feels alive immediately. Real interactions still set
  // `lastInteraction`, which re-arms the post-interaction resume delay.
  const mountedAt = useRef(0);
  const start = useRef(performance.now());
  const lastApplied = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Re-seed `lastApplied` (skip one frame's delta) whenever we re-enter the
  // noise regime, so switching back from the focus orbit doesn't apply a large
  // one-frame jump.
  const noiseSeeded = useRef(false);
  // Read store state via refs updated through a subscription so the high-
  // frequency `lastInteraction` and `mode` updates don't churn React.
  const stateRef = useRef({
    lastInteraction: useMapStore.getState().lastInteraction,
    mode: useMapStore.getState().mode,
    focusedId: useMapStore.getState().focusedId,
  });
  // Wall-clock time the current focus began — used to know when the glide has
  // landed so the orbit can take over.
  const focusStartedAt = useRef<number | null>(
    useMapStore.getState().focusedId ? Date.now() : null,
  );
  useEffect(() => {
    return useMapStore.subscribe((s) => {
      if (s.focusedId !== stateRef.current.focusedId) {
        focusStartedAt.current = s.focusedId ? Date.now() : null;
      }
      stateRef.current.lastInteraction = s.lastInteraction;
      stateRef.current.mode = s.mode;
      stateRef.current.focusedId = s.focusedId;
    });
  }, []);
  // Tuning params: read via ref so slider drags don't trigger re-renders here.
  const tuneRef = useRef(useTuningStore.getState());
  useEffect(() => useTuningStore.subscribe((s) => (tuneRef.current = s)), []);
  const reducedMotion = useReducedMotion();

  // World position of the album we're currently parked on (null if none).
  const albumCenter = (): [number, number] | null => {
    const s = useMapStore.getState();
    const id = s.focusedId;
    if (!id || !s.data) return null;
    const p = s.data.positions.find((q) => q.id === id);
    if (!p) return null;
    return interpolatePosition(p.audio, p.balanced, p.mood, s.sliderT);
  };

  useFrame(() => {
    const perfNow = performance.now();
    const wallNow = Date.now();
    const t = (perfNow - start.current) / 1000;
    const tune = tuneRef.current;

    const { lastInteraction, mode } = stateRef.current;
    const idleSince = Math.max(lastInteraction, mountedAt.current);
    const interactionGated =
      reducedMotion || wallNow - idleSince < tune.driftIdleDelayMs;

    // --- Focus regime: once the glide to an album has landed, slowly circle
    // that album for the rest of the hold. FlyToFocus owns the camera during
    // the glide itself; we only take over after focusFlyDurationMs so the nice
    // curved approach isn't disturbed.
    if (mode === "focus" && focusStartedAt.current != null) {
      const sinceFocus = wallNow - focusStartedAt.current;
      const arrived = sinceFocus >= tune.focusFlyDurationMs;
      if (arrived && !interactionGated) {
        const center = albumCenter();
        // Scale the orbit radius by 1/zoom (relative to focusZoom) so the
        // circle covers the same fraction of the viewport at any zoom — when
        // the user has manually zoomed in, the circle stays gentle instead of
        // swinging the album halfway across the screen.
        const zoomScale = tune.focusZoom / Math.max(0.001, camera.zoom);
        const orbitR = tune.orbitRadius * zoomScale;
        // Only orbit if the camera is still parked near the album. If the user
        // panned well away during the hold, don't yank it back into a circle —
        // leave it be and let AutoTour glide somewhere fresh. (Threshold scales
        // with the zoom-adjusted radius so it doesn't misfire when zoomed out.)
        const nearAlbum =
          center != null &&
          Math.hypot(
            camera.position.x - center[0],
            camera.position.y - center[1],
          ) <= orbitR * 3;
        if (center && nearAlbum) {
          const sinceArrival = sinceFocus - tune.focusFlyDurationMs;
          // Ease the radius in with a smoothstep so the orbit *velocity* starts
          // at zero — a linear ramp jumps straight to a constant outward speed
          // the instant the glide lands, which reads as an abrupt jerk to the
          // right. Smoothstep blends the circle smoothly out of the glide.
          const u = Math.min(1, sinceArrival / 2_500);
          const ramp = u * u * (3 - 2 * u);
          const r = orbitR * ramp;
          const orbPhase =
            (sinceArrival / 1_000) * tune.orbitFreqHz * 2.0 * Math.PI;
          camera.position.x = center[0] + Math.cos(orbPhase) * r;
          camera.position.y = center[1] + Math.sin(orbPhase) * r;
        }
      }
      // Either way, keep the noise regime unseeded so returning to overview
      // drift re-seeds cleanly without a jump.
      noiseSeeded.current = false;
      return;
    }

    // --- Overview / idle regime: gentle noise wander, applied as a delta on
    // top of any other motion so it never fights FlyToFocus.
    const phase = t * tune.driftFreqHz * 2.0 * Math.PI;
    const nx = noise2D(phase, phase * 0.73);
    const ny = noise2D(phase * 0.91 + 17.3, phase * 1.07 + 41.9);
    let targetX = nx * tune.driftAmplitude;
    let targetY = ny * tune.driftAmplitude;

    // Optional circular orbit layered on the overview drift (dev presets).
    if (tune.orbitEnabled) {
      const orbPhase = t * tune.orbitFreqHz * 2.0 * Math.PI;
      targetX += Math.cos(orbPhase) * tune.orbitRadius;
      targetY += Math.sin(orbPhase) * tune.orbitRadius;
    }

    if (interactionGated || !noiseSeeded.current) {
      // Track without applying — when drift resumes, the delta stays small.
      lastApplied.current.x = targetX;
      lastApplied.current.y = targetY;
      noiseSeeded.current = true;
      return;
    }

    // Apply the *delta* between this frame's target and the last applied
    // target. Drift then sits on top of any FlyToFocus motion instead of
    // fighting it.
    camera.position.x += targetX - lastApplied.current.x;
    camera.position.y += targetY - lastApplied.current.y;
    lastApplied.current.x = targetX;
    lastApplied.current.y = targetY;
  });

  return null;
}

function useReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
