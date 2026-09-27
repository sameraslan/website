"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";
import { TUNING } from "../state/tuning";

function noise2D(x: number, y: number): number {
  return (
    Math.sin(x * 1.13) * 0.5 +
    Math.sin(y * 0.87) * 0.3 +
    Math.sin(x * 0.41 + y * 0.59) * 0.2
  );
}

/**
 * Gentle idle wander of the overview camera. Only runs when nothing is
 * focused and the user has been idle (no cursor move, drag, wheel, or slider
 * drag) for `TUNING.driftIdleDelayMs`. Never sets `focusedId` or `mode`; it
 * only nudges `camera.position`, so it can never wash out the map or leave
 * focus stuck on an album the way the old auto-tour did.
 *
 * Under frameloop="demand" useFrame only runs on a rendered frame, and a
 * rendered frame only happens after invalidate(). Nothing else invalidates
 * merely because time passed, so this component arms a plain setTimeout for
 * "idle delay has now elapsed" and calls invalidate() itself once when it
 * fires; that produces exactly one rendered frame, at which point useFrame
 * below reads the (now unblocked) drift gate and starts calling invalidate()
 * every frame to keep animating. This keeps the canvas fully silent (zero
 * renders) while genuinely idle, which the idle-render screenshot check
 * (2s vs 6s, both well before the 10s delay) depends on.
 */
export function AmbientDrift() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  // mountedAt seeds the idle gate at the wall-clock time this component
  // mounted, so a fresh page load waits the full driftIdleDelayMs before
  // drift starts (rather than comparing against epoch 0, which would make
  // "wallNow - idleSince" enormous and skip the delay entirely). Real
  // interactions still set `lastInteraction`, which re-arms the resume delay.
  const mountedAt = useRef(Date.now());
  const start = useRef(performance.now());
  const lastApplied = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Re-seed `lastApplied` (skip one frame's delta) whenever we re-enter the
  // drift regime, so resuming after a focus or a gate doesn't apply a large
  // one-frame jump.
  const noiseSeeded = useRef(false);
  // Read store state via a subscription so the high-frequency
  // `lastInteraction` updates don't churn React.
  const stateRef = useRef({
    lastInteraction: useMapStore.getState().lastInteraction,
    lastCameraGrab: useMapStore.getState().lastCameraGrab,
    focusedId: useMapStore.getState().focusedId,
  });
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleWake = useRef(() => {});
  scheduleWake.current = () => {
    if (wakeTimer.current !== null) {
      clearTimeout(wakeTimer.current);
      wakeTimer.current = null;
    }
    const { lastInteraction, lastCameraGrab, focusedId } = stateRef.current;
    if (focusedId != null) return; // drift never runs while focused
    const idleSince = Math.max(lastInteraction, lastCameraGrab, mountedAt.current);
    const remaining = idleSince + TUNING.driftIdleDelayMs - Date.now();
    wakeTimer.current = setTimeout(
      () => {
        wakeTimer.current = null;
        invalidate();
      },
      Math.max(0, remaining),
    );
  };

  useEffect(() => {
    scheduleWake.current();
    const unsubscribe = useMapStore.subscribe((s) => {
      stateRef.current.lastInteraction = s.lastInteraction;
      stateRef.current.lastCameraGrab = s.lastCameraGrab;
      stateRef.current.focusedId = s.focusedId;
      // Any interaction, camera grab, or focus change moves the idle
      // deadline: re-arm the wake timer against the new value.
      scheduleWake.current();
    });
    return () => {
      unsubscribe();
      if (wakeTimer.current !== null) clearTimeout(wakeTimer.current);
    };
  }, []);
  const reducedMotion = useReducedMotion();

  useFrame(() => {
    const perfNow = performance.now();
    const wallNow = Date.now();
    const t = (perfNow - start.current) / 1000;

    const { lastInteraction, lastCameraGrab, focusedId } = stateRef.current;

    // Drift is overview-only: no orbiting a focused album, ever.
    if (focusedId != null) {
      noiseSeeded.current = false;
      return;
    }

    const idleSince = Math.max(lastInteraction, lastCameraGrab, mountedAt.current);
    const interactionGated =
      reducedMotion || wallNow - idleSince < TUNING.driftIdleDelayMs;

    if (interactionGated) {
      // Not yet time to drift: the wake timer (armed above) will invalidate
      // exactly once the delay elapses. Don't invalidate here — that would
      // turn frameloop="demand" back into "always" while idle.
      noiseSeeded.current = false;
      return;
    }

    const phase = t * TUNING.driftFreqHz * 2.0 * Math.PI;
    const nx = noise2D(phase, phase * 0.73);
    const ny = noise2D(phase * 0.91 + 17.3, phase * 1.07 + 41.9);
    const targetX = nx * TUNING.driftAmplitude;
    const targetY = ny * TUNING.driftAmplitude;

    if (!noiseSeeded.current) {
      // Track without applying: when drift resumes, the delta stays small.
      lastApplied.current.x = targetX;
      lastApplied.current.y = targetY;
      noiseSeeded.current = true;
      invalidate();
      return;
    }

    // Apply the *delta* between this frame's target and the last applied
    // target. Drift then sits on top of any FlyToFocus motion instead of
    // fighting it.
    camera.position.x += targetX - lastApplied.current.x;
    camera.position.y += targetY - lastApplied.current.y;
    lastApplied.current.x = targetX;
    lastApplied.current.y = targetY;
    // Drift is active: keep the demand loop alive every frame while it runs.
    invalidate();
  });

  return null;
}

function useReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
