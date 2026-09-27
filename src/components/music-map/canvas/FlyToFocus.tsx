"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { cloudCenter, fitZoom, getFullBounds } from "../state/bounds";
import { easeOutCubic, interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { TUNING } from "../state/tuning";
import { getOverviewFraming, setOverviewFraming } from "../state/view";
import type { MapData } from "../data/types";

const MAX_ZOOM = 5.0;

/**
 * Computes the "whole cloud visible" framing (fitZoom + centre) for the
 * current sliderT and stores it in state/view.ts, without touching the
 * camera. Read by CameraRig (dynamic MIN_ZOOM), shaders/album.ts's sprite
 * size curve (via AlbumField's u_fitZoom), canvas/RegionLabels.tsx (label
 * fade), and canvas/AtlasManager.tsx (lazy-load gate).
 */
function computeAndStoreOverviewFraming(
  data: MapData,
  sliderT: number,
  cam: THREE.OrthographicCamera,
): { zoom: number; center: { x: number; y: number } } {
  const cloud = getFullBounds(data, sliderT);
  const center = cloudCenter(cloud);
  const frustum = { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom };
  const zoom = Math.min(fitZoom(cloud, frustum), MAX_ZOOM);
  setOverviewFraming({ zoom, center });
  return { zoom, center };
}

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
  // Whether any focus has happened yet — gates the initial release so we don't
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

  useEffect(() => {
    if (!data) return;
    const cam = camera as THREE.OrthographicCamera;
    const firstRun = !didInit.current;
    didInit.current = true;

    if (!focusedId) {
      if (!everFocused.current) {
        // Fresh load, nothing ever focused: frame the camera on the whole
        // album cloud (fitZoom + cloudCenter), not the world origin and not
        // a fixed default zoom, so the map never opens showing only a
        // fragment of the cloud (task 8 fix round 2: the old median-snap
        // only moved the camera's position, leaving the fixed zoom=2.4
        // frustum far too narrow once the real, unsampled dataset's extent
        // turned out much wider). One-time and instant: no animation, no
        // focus, no mode change.
        if (firstRun) {
          const { zoom, center } = computeAndStoreOverviewFraming(
            data,
            useMapStore.getState().sliderT,
            cam,
          );
          cam.position.x = center.x;
          cam.position.y = center.y;
          cam.zoom = zoom;
          cam.updateProjectionMatrix();
          invalidate();
        }
        return;
      }
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

  // Recompute the fitted overview framing (fitZoom + centre) whenever the
  // slider moves, since each stop has its own extent, so the "reset view" /
  // min-zoom logic (CameraRig, RegionLabels, AtlasManager) always matches
  // the current stop. This never moves the camera itself: only the one-time
  // initial snap above and the focus-release glide do that.
  useEffect(() => {
    if (!data) return;
    const cam = camera as THREE.OrthographicCamera;
    computeAndStoreOverviewFraming(data, sliderT, cam);
  }, [data, sliderT, camera]);

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
