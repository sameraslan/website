"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { easeOutCubic, interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { TUNING } from "../state/tuning";
import { type CameraView, getOverviewFraming, releaseView } from "../state/view";

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
  /** "release" glides back to the pre-focus view; everything else is "fly". */
  kind: "fly" | "release";
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
 * album-to-album glides read as gentle curves rather than ruler-straight cuts.
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
  // Whether any focus has happened yet: gates the initial release so a
  // release before any focus leaves InitialFrame's fitted framing alone.
  const everFocused = useRef(false);
  // First effect run = the mount. focusedId is never restored from the
  // session, so on mount it is null and we leave the camera where it starts.
  const didInit = useRef(false);
  // The camera view (position and zoom) captured when focus began from an
  // unfocused state; releasing focus glides back to it (releaseView in
  // state/view.ts). Hopping album to album keeps the original. Cleared once
  // a release glide completes, or when a camera grab cancels it.
  const preFocusView = useRef<CameraView | null>(null);
  // focusedId as of the previous focus effect run, to tell "focus from
  // unfocused" apart from an album-to-album hop.
  const prevFocusedId = useRef<string | null>(null);

  // eslint-disable-next-line react-hooks/immutability -- this effect mutates the R3F camera in place on focus changes (see the mutation sites below); the standard R3F pattern for driving a long-lived, GPU-backed camera object.
  useEffect(() => {
    if (!data) return;
    const cam = camera as THREE.OrthographicCamera;
    const firstRun = !didInit.current;
    didInit.current = true;
    const wasFocused = prevFocusedId.current != null;
    prevFocusedId.current = focusedId;

    if (!focusedId) {
      // Fresh load, nothing ever focused: leave the camera where
      // InitialFrame put it (the fitted overview framing).
      if (!everFocused.current) return;
      // Glide position and zoom back to the view captured when focus began,
      // or to the fitted overview (centre and zoom, state/view.ts) if none
      // was captured, e.g. focus restored on a remount. Gliding only the
      // zoom would leave the camera parked over the focused album, showing
      // mostly empty paper with the cloud off to one side.
      const here = new THREE.Vector2(cam.position.x, cam.position.y);
      const target = releaseView(preFocusView.current, getOverviewFraming());
      const to = new THREE.Vector2(target.x, target.y);
      anim.current = {
        startMs: performance.now(),
        startWall: Date.now(),
        durationMs: TUNING.focusReleaseDurationMs,
        fromPos: here,
        toPos: to,
        ctrl: here.clone().add(to).multiplyScalar(0.5),
        fromZoom: cam.zoom,
        toZoom: target.zoom,
        instant: prefersReducedMotion(),
        kind: "release",
      };
      invalidate();
      return;
    }

    everFocused.current = true;
    // Focus from an unfocused state: remember the view to release back to.
    // Not on the first run (a restored focus has no meaningful "before"),
    // and not while a release glide is still carrying the original view.
    if (!wasFocused && !firstRun && preFocusView.current == null) {
      preFocusView.current = { x: cam.position.x, y: cam.position.y, zoom: cam.zoom };
    }
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

    // Focus from an unfocused state eases in to focusZoom (or keeps the
    // user's own zoom if it is already closer); album-to-album hops keep
    // whatever zoom is current, so a manual zoom while focused survives.
    // Keyed on the previous focus rather than "first focus ever", so a
    // focus after a release zooms in again instead of staying at overview.
    const toZoom = wasFocused ? cam.zoom : Math.max(cam.zoom, TUNING.focusZoom);

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
        kind: "fly",
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
      kind: "fly",
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
      kind: "fly",
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
      if (a.kind === "release") preFocusView.current = null;
      // One more frame so components that read the camera earlier in the
      // frame order (CameraRig's zoomRef, which drives the sprite-size
      // uniform) pick up the new zoom under frameloop="demand".
      invalidate();
      return;
    }
    // The user grabbed the camera (drag/wheel/pinch) after this glide began:
    // bail so manual control takes over instantly instead of fighting the
    // glide. A slider drag is not a grab (it retargets the glide in place,
    // see the sliderT effect above), and hover/pointermove alone
    // (lastInteraction) never cancels it.
    if (useMapStore.getState().lastCameraGrab > a.startWall) {
      anim.current = null;
      // The user took over mid-release: the next focus captures a fresh view.
      if (a.kind === "release") preFocusView.current = null;
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
      if (a.kind === "release") preFocusView.current = null;
      // Settle frame: same reason as the instant branch above, the final
      // camera write must reach zoomRef and the uniforms.
      invalidate();
    } else {
      // Glide still in flight: keep the demand loop alive next frame.
      invalidate();
    }
  });

  return null;
}
