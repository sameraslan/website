"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { easeOutCubic, interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { TUNING } from "../state/tuning";
import { getOverviewFraming } from "../state/view";

interface Animation {
  startMs: number;
  /** Wall-clock (Date.now) start, compared against lastInteraction to bail. */
  startWall: number;
  durationMs: number;
  fromPos: THREE.Vector2;
  toPos: THREE.Vector2;
  /** Quadratic-bezier control point, bows the path into a curve. */
  ctrl: THREE.Vector2;
  fromZoom: number;
  toZoom: number;
  instant: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Short retarget ease used when the slider moves a focused album's position
// after the glide to it has already finished (no animation in flight). Long
// enough to read as a smooth correction, short enough that it never feels
// like a fresh fly-to.
const SLIDER_RETARGET_DURATION_MS = 120;

/**
 * Control point for a curved glide: the straight midpoint pushed sideways
 * (perpendicular to the travel direction) by a randomized fraction of the
 * distance, with a random side. Straight hops become gentle, varied arcs so
 * the tour reads as a wandering, circular drift rather than ruler-straight cuts.
 */
function arcControlPoint(from: THREE.Vector2, to: THREE.Vector2): THREE.Vector2 {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return mid;
  // Perpendicular unit vector.
  const px = -dy / dist;
  const py = dx / dist;
  const side = Math.random() < 0.5 ? -1 : 1;
  const bow = dist * (0.3 + Math.random() * 0.35) * side;
  return new THREE.Vector2(mid.x + px * bow, mid.y + py * bow);
}

export function FlyToFocus() {
  const { camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const data = useMapStore((s) => s.data);
  const focusedId = useMapStore((s) => s.focusedId);
  const sliderT = useMapStore((s) => s.sliderT);
  const anim = useRef<Animation | null>(null);
  // Whether any focus has happened yet: gates the initial release so we don't
  // pin the camera to the world origin before the tour places it.
  const everFocused = useRef(false);
  // First effect run = the mount. focusedId is never restored from the
  // session, so on mount it is null and we leave the camera where it starts.
  const didInit = useRef(false);
  // The very first focus after load eases the zoom in to focusZoom (the intro).
  // Every hop after that PRESERVES the current zoom instead of resetting it, so
  // if the user has manually zoomed in, the tour keeps gliding + circling at
  // their zoom rather than yanking back out to the tour default.
  const introDone = useRef(false);

  // eslint-disable-next-line react-hooks/immutability -- this effect mutates the R3F camera in place on focus changes (see the mutation sites below); the standard R3F pattern for driving a long-lived, GPU-backed camera object.
  useEffect(() => {
    if (!data) return;
    const cam = camera as THREE.OrthographicCamera;
    const firstRun = !didInit.current;
    didInit.current = true;

    if (!focusedId) {
      // Fresh load, nothing ever focused: leave the camera where
      // InitialFrame put it (the fitted overview framing).
      if (!everFocused.current) return;
      const here = new THREE.Vector2(cam.position.x, cam.position.y);
      anim.current = {
        startMs: performance.now(),
        startWall: Date.now(),
        durationMs: TUNING.focusReleaseDurationMs,
        fromPos: here.clone(),
        toPos: here.clone(),
        ctrl: here.clone(),
        fromZoom: cam.zoom,
        // The fitted overview zoom (state/view.ts), not the fixed
        // TUNING.overviewZoom fallback: releasing focus should return to
        // the "whole cloud visible" framing, which TUNING.overviewZoom only
        // approximates until the real fit has been computed.
        toZoom: getOverviewFraming().zoom,
        instant: prefersReducedMotion(),
      };
      invalidate();
      return;
    }

    everFocused.current = true;
    const target = data.positions.find((p) => p.id === focusedId);
    if (!target) return;
    const currentSliderT = useMapStore.getState().sliderT;
    const [tx, ty] = interpolatePosition(
      target.audio,
      target.balanced,
      target.mood,
      currentSliderT,
    );
    const toPos = new THREE.Vector2(tx, ty);

    // Intro hop eases to focusZoom; later hops keep whatever zoom is current
    // (the user's manual zoom, or the focusZoom the intro settled on).
    const toZoom = introDone.current ? cam.zoom : TUNING.focusZoom;
    introDone.current = true;

    if (firstRun) {
      // Restored focus: snap onto the album and ease only the zoom, so the page
      // opens on the album instead of sliding across empty space from (0,0).
      // eslint-disable-next-line react-hooks/immutability -- see the effect-level comment above.
      cam.position.x = tx;
      cam.position.y = ty;
      cam.updateProjectionMatrix();
      anim.current = {
        startMs: performance.now(),
        startWall: Date.now(),
        durationMs: TUNING.focusFlyDurationMs,
        fromPos: toPos.clone(),
        toPos: toPos.clone(),
        ctrl: toPos.clone(),
        fromZoom: cam.zoom,
        toZoom,
        instant: prefersReducedMotion(),
      };
      invalidate();
      return;
    }

    const fromPos = new THREE.Vector2(cam.position.x, cam.position.y);
    anim.current = {
      startMs: performance.now(),
      startWall: Date.now(),
      durationMs: TUNING.focusFlyDurationMs,
      fromPos,
      toPos,
      ctrl: arcControlPoint(fromPos, toPos),
      fromZoom: cam.zoom,
      toZoom,
      instant: prefersReducedMotion(),
    };
    invalidate();
  }, [focusedId, data, camera, invalidate]);

  // sliderT moves every album's world position, including the focused one.
  useEffect(() => {
    if (!data || !focusedId) return;
    const target = data.positions.find((p) => p.id === focusedId);
    if (!target) return;
    const [tx, ty] = interpolatePosition(target.audio, target.balanced, target.mood, sliderT);
    const a = anim.current;
    if (a) {
      // A glide is already in flight: update its target in place rather than
      // restarting (which would reset the timing and re-trigger the curve on
      // every slider tick).
      const dx = tx - a.toPos.x;
      const dy = ty - a.toPos.y;
      a.toPos.set(tx, ty);
      a.ctrl.x += dx;
      a.ctrl.y += dy;
      invalidate();
      return;
    }
    // No glide in flight: the fly-to already landed, but the slider just
    // moved the focused album's world position out from under the camera.
    // Ease the camera back onto it with a short retarget so it never
    // desyncs from the album it's supposedly parked on. This does not
    // register a camera grab and does not touch focus/mode.
    const cam = camera as THREE.OrthographicCamera;
    const fromPos = new THREE.Vector2(cam.position.x, cam.position.y);
    const toPos = new THREE.Vector2(tx, ty);
    if (fromPos.distanceToSquared(toPos) < 1e-10) return;
    anim.current = {
      startMs: performance.now(),
      startWall: Date.now(),
      durationMs: SLIDER_RETARGET_DURATION_MS,
      fromPos,
      toPos,
      ctrl: fromPos.clone().add(toPos).multiplyScalar(0.5),
      fromZoom: cam.zoom,
      toZoom: cam.zoom,
      instant: prefersReducedMotion(),
    };
    invalidate();
  }, [sliderT, data, focusedId, camera, invalidate]);

  // eslint-disable-next-line react-hooks/immutability -- this per-frame callback mutates the R3F camera in place to drive the fly-to glide (see the mutation sites below); the standard R3F pattern for a hot-path camera animation.
  useFrame(() => {
    if (!anim.current) return;
    const cam = camera as THREE.OrthographicCamera;
    const a = anim.current;
    if (a.instant) {
      // eslint-disable-next-line react-hooks/immutability -- see the useFrame-level comment above.
      cam.position.x = a.toPos.x;
      cam.position.y = a.toPos.y;
      // eslint-disable-next-line react-hooks/immutability -- see the useFrame-level comment above.
      cam.zoom = a.toZoom;
      cam.updateProjectionMatrix();
      anim.current = null;
      return;
    }
    // The user grabbed the camera (drag/wheel/slider-drag) after this glide
    // began: bail so manual control takes over instantly instead of fighting
    // the glide. Hover/pointermove alone (lastInteraction) never cancels it.
    if (useMapStore.getState().lastCameraGrab > a.startWall) {
      anim.current = null;
      return;
    }
    const t = (performance.now() - a.startMs) / a.durationMs;
    const k = easeOutCubic(t);
    // Quadratic bezier: (1-k)^2*from + 2(1-k)k*ctrl + k^2*to.
    const mk = 1 - k;
    const w0 = mk * mk;
    const w1 = 2 * mk * k;
    const w2 = k * k;
    cam.position.x = w0 * a.fromPos.x + w1 * a.ctrl.x + w2 * a.toPos.x;
    cam.position.y = w0 * a.fromPos.y + w1 * a.ctrl.y + w2 * a.toPos.y;
    cam.zoom = a.fromZoom + (a.toZoom - a.fromZoom) * k;
    cam.updateProjectionMatrix();
    if (t >= 1) {
      anim.current = null;
    } else {
      // Glide still in flight: keep the demand loop alive next frame.
      invalidate();
    }
  });

  return null;
}
