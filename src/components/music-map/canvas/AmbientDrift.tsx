"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * focused, the mouse is not over the canvas, and the user has been idle (no
 * drag, wheel, or slider drag, and no pointer leaving the canvas) for
 * `TUNING.driftIdleDelayMs`. A mouse resting on the map never sees it move:
 * drift under a stationary cursor would slide albums out from under it. Never sets `focusedId` or `mode`; it
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
  const gl = useThree((s) => s.gl);
  // Whether a mouse or pen is over the canvas right now (set on
  // pointerenter/pointermove, cleared on pointerleave and on unmount), and
  // when it last left, which restarts the idle delay.
  const pointerInside = useRef(false);
  const pointerLeftAt = useRef(0);
  // mountedAt seeds the idle gate at the wall-clock time this component
  // mounted, so a fresh page load waits the full driftIdleDelayMs before
  // drift starts (rather than comparing against epoch 0, which would make
  // "wallNow - idleSince" enormous and skip the delay entirely). Real
  // interactions still set `lastInteraction`, which re-arms the resume delay.
  // Lazy initializers (called once on mount, not on every render) rather
  // than useRef(Date.now())/useRef(performance.now()): a bare useRef's
  // argument is still evaluated on every render even though only the first
  // call's value is kept, which reads as an impure call during render.
  const [mountedAt] = useState(Date.now);
  // performance.now (unlike Date.now) is not callable unbound: it needs
  // `this` to be the Performance object, so it's wrapped in an arrow rather
  // than passed as a bare reference.
  const [start] = useState(() => performance.now());
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
  // Assigning scheduleWake.current directly in the render body would write a
  // ref during render; a no-deps layout effect keeps it just as fresh
  // (re-synced after every render, before the mount effect below or any
  // subscription callback can call it) without doing so during render.
  useLayoutEffect(() => {
    scheduleWake.current = () => {
      if (wakeTimer.current !== null) {
        clearTimeout(wakeTimer.current);
        wakeTimer.current = null;
      }
      const { lastInteraction, lastCameraGrab, focusedId } = stateRef.current;
      if (focusedId != null) return; // drift never runs while focused
      if (pointerInside.current) return; // re-armed on pointerleave
      const idleSince = Math.max(lastInteraction, lastCameraGrab, mountedAt, pointerLeftAt.current);
      const remaining = idleSince + TUNING.driftIdleDelayMs - Date.now();
      wakeTimer.current = setTimeout(
        () => {
          wakeTimer.current = null;
          invalidate();
        },
        Math.max(0, remaining),
      );
    };
  });

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

  useEffect(() => {
    const canvas = gl.domElement;
    function onInside(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      pointerInside.current = true;
    }
    function onLeave(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      pointerInside.current = false;
      pointerLeftAt.current = Date.now();
      scheduleWake.current();
    }
    canvas.addEventListener("pointerenter", onInside);
    canvas.addEventListener("pointermove", onInside);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointerenter", onInside);
      canvas.removeEventListener("pointermove", onInside);
      canvas.removeEventListener("pointerleave", onLeave);
      pointerInside.current = false;
    };
  }, [gl]);
  const reducedMotion = useReducedMotion();

  // This callback mutates the R3F camera object in place (see the comment
  // at the mutation site below); mutating three.js objects directly inside
  // useFrame is the standard R3F pattern, not something to restructure into
  // setState.
  // eslint-disable-next-line react-hooks/immutability
  useFrame(() => {
    const perfNow = performance.now();
    const wallNow = Date.now();
    const t = (perfNow - start) / 1000;

    const { lastInteraction, lastCameraGrab, focusedId } = stateRef.current;

    // Drift is overview-only: no orbiting a focused album, ever.
    if (focusedId != null) {
      noiseSeeded.current = false;
      return;
    }

    const idleSince = Math.max(lastInteraction, lastCameraGrab, mountedAt, pointerLeftAt.current);
    const interactionGated =
      reducedMotion ||
      pointerInside.current ||
      wallNow - idleSince < TUNING.driftIdleDelayMs;

    if (interactionGated) {
      // Not yet time to drift: the wake timer (armed above) will invalidate
      // exactly once the delay elapses. Don't invalidate here, that would
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
    // fighting it. Mutating the R3F camera object in place inside useFrame
    // is the standard three.js/R3F pattern (the camera is a long-lived
    // mutable object, not React-owned state); restructuring it into
    // setState would re-render every frame instead of just redrawing the
    // canvas.
    // eslint-disable-next-line react-hooks/immutability
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
