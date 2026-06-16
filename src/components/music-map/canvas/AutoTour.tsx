"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { MapData } from "../data/types";
import { getMainBounds } from "../state/bounds";
import { interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { useTuningStore } from "../state/tuning";

type Stage = "waiting" | "holding";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Index of the album nearest the middle of the (percentile-trimmed) cloud. */
function centralAlbumIndex(data: MapData, sliderT: number): number {
  const b = getMainBounds(data, sliderT);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < data.positions.length; i++) {
    const p = data.positions[i];
    const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

export function AutoTour() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  // Mirror AmbientDrift's ref pattern: read store via a subscription so per-
  // frame churn doesn't push React renders.
  const stateRef = useRef({
    focusedId: useMapStore.getState().focusedId,
    mode: useMapStore.getState().mode,
    lastInteraction: useMapStore.getState().lastInteraction,
  });
  useEffect(() => {
    return useMapStore.subscribe((s) => {
      stateRef.current.focusedId = s.focusedId;
      stateRef.current.mode = s.mode;
      stateRef.current.lastInteraction = s.lastInteraction;
    });
  }, []);
  const tuneRef = useRef(useTuningStore.getState());
  useEffect(() => useTuningStore.subscribe((s) => (tuneRef.current = s)), []);

  const stage = useRef<Stage>("waiting");
  const stageUntil = useRef(0);
  const autoFocusedId = useRef<string | null>(null);
  // Seeded at 0 (not mount time) so engagement is gated purely on *real*
  // interaction: on a fresh load with the pointer off the canvas the tour can
  // begin right away, but while the user is active over the canvas it stays put.
  const mountedAt = useRef(0);
  const initialized = useRef(false);

  useFrame(() => {
    const tune = tuneRef.current;
    if (!tune.tourEnabled) {
      // Mode without an auto-tour: relinquish any album we were holding.
      if (autoFocusedId.current) {
        useMapStore.getState().focus(null);
        autoFocusedId.current = null;
        stage.current = "waiting";
      }
      return;
    }
    const data = useMapStore.getState().data;
    if (!data || data.positions.length === 0) return;

    const now = Date.now();
    const { focusedId, mode, lastInteraction } = stateRef.current;
    const idleSince = Math.max(lastInteraction, mountedAt.current);

    // Choose the next album to glide to. In nearby mode we pick a random album
    // within tourNearbyRadius of the camera, so the tour random-walks across
    // the map through dense areas instead of cutting to far, isolated covers
    // (which read as "blank screens"). The currently focused album is excluded
    // so each hop actually moves.
    const pickIndex = (): number => {
      const sliderT = useMapStore.getState().sliderT;
      const currentId = useMapStore.getState().focusedId;
      const positions = data.positions;
      // Confine the tour to the dense core. The cloud has a long skewed tail of
      // outlier albums; gliding out to one reads as drifting off into empty
      // whitespace (and a "blank screen" mid-glide). Keep every target inside
      // the median-centered main bounds so the tour stays in the populated mass.
      const b = getMainBounds(data, sliderT);
      const inCore = (px: number, py: number) =>
        px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
      if (tune.tourNearbyOnly) {
        const cx = camera.position.x;
        const cy = camera.position.y;
        const r2 = tune.tourNearbyRadius * tune.tourNearbyRadius;
        const candidates: number[] = [];
        let nearestIdx = -1;
        let nearestD2 = Infinity;
        for (let i = 0; i < positions.length; i++) {
          if (positions[i].id === currentId) continue;
          const p = positions[i];
          const [px, py] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
          if (!inCore(px, py)) continue;
          const dx = px - cx;
          const dy = py - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2) candidates.push(i);
          if (d2 < nearestD2) {
            nearestD2 = d2;
            nearestIdx = i;
          }
        }
        return candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : nearestIdx;
      }
      // Fully random, but still confined to the dense core.
      const core: number[] = [];
      for (let i = 0; i < positions.length; i++) {
        if (positions[i].id === currentId) continue;
        const p = positions[i];
        const [px, py] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
        if (inCore(px, py)) core.push(i);
      }
      if (core.length === 0) return -1;
      return core[Math.floor(Math.random() * core.length)];
    };

    const hopTo = (idx: number) => {
      if (idx < 0) return;
      const pick = data.positions[idx];
      autoFocusedId.current = pick.id;
      useMapStore.getState().focus(pick.id);
      stage.current = "holding";
      stageUntil.current = now + tune.tourHoldMs;
    };

    // One-shot on first frame: frame the cloud so the map never opens in the
    // empty margin to the side of the album mass.
    if (!initialized.current) {
      initialized.current = true;
      const store = useMapStore.getState();
      const snapTo = (id: string): boolean => {
        const p = data.positions.find((q) => q.id === id);
        if (!p) return false;
        const [cx, cy] = interpolatePosition(p.audio, p.balanced, p.mood, store.sliderT);
        camera.position.x = cx;
        camera.position.y = cy;
        camera.updateProjectionMatrix();
        return true;
      };
      if (store.focusedId && snapTo(store.focusedId)) {
        // A focus restored from the session (FlyToFocus eases the zoom in):
        // settle on it and hold rather than snapping back to the origin.
        autoFocusedId.current = store.focusedId;
        stage.current = "holding";
        stageUntil.current = now + tune.tourHoldMs;
        return;
      }
      // Fresh load: centre on the album nearest the middle of the cloud. The
      // waiting branch below then glides into a nearby album once the user is
      // idle (or immediately, if the pointer is away).
      const idx = centralAlbumIndex(data, store.sliderT);
      if (idx >= 0) snapTo(data.positions[idx].id);
    }

    if (prefersReducedMotion()) return;

    if (stage.current === "holding") {
      // The user grabbed the wheel (clicked another album, panned, zoomed, or
      // moved the cursor over the map): hand control back. Drop our claim so the
      // waiting branch re-engages once they've settled for the idle delay.
      const hopStart = stageUntil.current - tune.tourHoldMs;
      const interruptedByFocus = focusedId !== autoFocusedId.current;
      const interruptedByInput = lastInteraction > hopStart;
      if (interruptedByFocus || interruptedByInput) {
        autoFocusedId.current = null;
        stage.current = "waiting";
        return;
      }
      // Linger on the album (AmbientDrift circles the camera around it during
      // the hold), then glide straight to the next one — no zoom-out, no pause,
      // so it reads as one continuous wander.
      if (now >= stageUntil.current) hopTo(pickIndex());
      return;
    }

    // waiting: only act once the user has been idle for the delay — pointer off
    // the canvas (no pointer events) or held still long enough. While they're
    // actively moving over the canvas, lastInteraction keeps this gated and the
    // camera stays under full manual control.
    if (now - idleSince < tune.tourIdleDelayMs) return;
    // A focus may still be parked (a manual click, an interrupted tour, or one
    // restored from a previous session). Glide straight to a fresh album rather
    // than first snapping out to overview — this is "it starts moving again"
    // after you click into a section and move away.
    if (focusedId !== null) {
      hopTo(pickIndex());
      return;
    }
    if (mode !== "idle") return;
    hopTo(pickIndex());
  });

  return null;
}
