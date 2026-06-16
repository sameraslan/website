"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { easeInOutCubic, interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { useTuningStore } from "../state/tuning";

interface Animation {
  startMs: number;
  /** Wall-clock (Date.now) start, compared against lastInteraction to bail. */
  startWall: number;
  durationMs: number;
  fromPos: THREE.Vector2;
  toPos: THREE.Vector2;
  /** Quadratic-bezier control point — bows the path into a curve. */
  ctrl: THREE.Vector2;
  fromZoom: number;
  toZoom: number;
  instant: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
  const data = useMapStore((s) => s.data);
  const focusedId = useMapStore((s) => s.focusedId);
  const sliderT = useMapStore((s) => s.sliderT);
  const anim = useRef<Animation | null>(null);
  // Whether any focus has happened yet — gates the initial release so we don't
  // pin the camera to the world origin before the tour places it.
  const everFocused = useRef(false);
  // First effect run = the mount. focusedId is never restored from the session,
  // so on mount it is null and we leave the camera for AutoTour to frame.
  const didInit = useRef(false);
  // The very first focus after load eases the zoom in to focusZoom (the intro).
  // Every hop after that PRESERVES the current zoom instead of resetting it, so
  // if the user has manually zoomed in, the tour keeps gliding + circling at
  // their zoom rather than yanking back out to the tour default.
  const introDone = useRef(false);

  useEffect(() => {
    if (!data) return;
    const cam = camera as THREE.OrthographicCamera;
    const tune = useTuningStore.getState();
    const firstRun = !didInit.current;
    didInit.current = true;

    if (!focusedId) {
      // Nothing focused yet on a fresh mount: leave the camera alone so AutoTour
      // can frame the cloud. Only animate a release once we've actually focused.
      if (!everFocused.current) return;
      const here = new THREE.Vector2(cam.position.x, cam.position.y);
      anim.current = {
        startMs: performance.now(),
        startWall: Date.now(),
        durationMs: tune.focusReleaseDurationMs,
        fromPos: here.clone(),
        toPos: here.clone(),
        ctrl: here.clone(),
        fromZoom: cam.zoom,
        toZoom: tune.overviewZoom,
        instant: prefersReducedMotion(),
      };
      return;
    }

    everFocused.current = true;
    const target = data.positions.find((p) => p.id === focusedId);
    if (!target) return;
    const [tx, ty] = interpolatePosition(target.audio, target.balanced, target.mood, sliderT);
    const toPos = new THREE.Vector2(tx, ty);

    // Intro hop eases to focusZoom; later hops keep whatever zoom is current
    // (the user's manual zoom, or the focusZoom the intro settled on).
    const toZoom = introDone.current ? cam.zoom : tune.focusZoom;
    introDone.current = true;

    if (firstRun) {
      // Restored focus: snap onto the album and ease only the zoom, so the page
      // opens on the album instead of sliding across empty space from (0,0).
      cam.position.x = tx;
      cam.position.y = ty;
      cam.updateProjectionMatrix();
      anim.current = {
        startMs: performance.now(),
        startWall: Date.now(),
        durationMs: tune.focusFlyDurationMs,
        fromPos: toPos.clone(),
        toPos: toPos.clone(),
        ctrl: toPos.clone(),
        fromZoom: cam.zoom,
        toZoom,
        instant: prefersReducedMotion(),
      };
      return;
    }

    const fromPos = new THREE.Vector2(cam.position.x, cam.position.y);
    anim.current = {
      startMs: performance.now(),
      startWall: Date.now(),
      durationMs: tune.focusFlyDurationMs,
      fromPos,
      toPos,
      ctrl: arcControlPoint(fromPos, toPos),
      fromZoom: cam.zoom,
      toZoom,
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
    // The user grabbed the camera (pan/drag/zoom) after this glide began: bail
    // so manual control takes over instantly instead of fighting the glide.
    if (useMapStore.getState().lastInteraction > a.startWall) {
      anim.current = null;
      return;
    }
    const t = (performance.now() - a.startMs) / a.durationMs;
    const k = easeInOutCubic(t);
    // Quadratic bezier: (1-k)^2*from + 2(1-k)k*ctrl + k^2*to.
    const mk = 1 - k;
    const w0 = mk * mk;
    const w1 = 2 * mk * k;
    const w2 = k * k;
    cam.position.x = w0 * a.fromPos.x + w1 * a.ctrl.x + w2 * a.toPos.x;
    cam.position.y = w0 * a.fromPos.y + w1 * a.ctrl.y + w2 * a.toPos.y;
    cam.zoom = a.fromZoom + (a.toZoom - a.fromZoom) * k;
    cam.updateProjectionMatrix();
    if (t >= 1) anim.current = null;
  });

  return null;
}
