import type { MapData } from "../data/types";
import { interpolatePosition } from "./projection";

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

let cacheKey = "";
let cached: Bounds | null = null;

/**
 * Robust, **median-centered** bounding box of the album cloud's dense mass at
 * the current slider position.
 *
 * Each slider stop is normalized independently (median → origin, p5..p95 →
 * ±0.55), but the balanced/mood projections are heavily skewed: a long tail of
 * outliers drags a raw p2..p98 box's *center* far off into empty space (e.g.
 * (-1.6, -0.8) at sliderT 0.6) even though the dense bulk still sits at the
 * origin. Centering the camera on such a box frames a sparse void with a lone
 * album in it.
 *
 * So we center on the **median** (where the dense mass actually is) and size
 * the box from a **symmetric inter-percentile spread** around that median,
 * which is robust to the skew. The result is the populated core the camera
 * should stay within — outliers fall outside it and are never framed.
 *
 * Bounds shift with sliderT (positions interpolate between stops), so the box
 * is keyed on (count, sliderT) and memoized: the slider changes rarely
 * relative to the 60fps clamp loop that reads this.
 */
export function getMainBounds(
  data: MapData,
  sliderT: number,
  lo = 0.1,
  hi = 0.9,
): Bounds {
  const n = data.positions.length;
  const key = `${n}:${sliderT.toFixed(3)}:${lo}:${hi}`;
  if (key === cacheKey && cached) return cached;

  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = data.positions[i];
    const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
    xs[i] = x;
    ys[i] = y;
  }
  // Typed-array sort is numeric by default.
  xs.sort();
  ys.sort();

  const at = (arr: Float64Array, q: number) =>
    arr[Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))];

  // Median center + symmetric half-spread (inter-percentile range / 2). This
  // ignores the skewed tail that would otherwise pull the box off-center.
  const cx = at(xs, 0.5);
  const cy = at(ys, 0.5);
  const halfX = (at(xs, hi) - at(xs, lo)) / 2;
  const halfY = (at(ys, hi) - at(ys, lo)) / 2;

  cached = {
    minX: cx - halfX,
    maxX: cx + halfX,
    minY: cy - halfY,
    maxY: cy + halfY,
  };
  cacheKey = key;
  return cached;
}

/**
 * True (untrimmed) bounding box of every album's position at the given
 * sliderT. Unlike `getMainBounds` (median-centered, robust to outliers, used
 * only for the idle-camera nudge), this literally includes outliers, so the
 * "whole cloud is visible" guarantee `fitZoom`/`cloudCenter` below provide is
 * real. Used only for the one-time initial camera framing.
 */
export function getFullBounds(data: MapData, sliderT: number): Bounds {
  const n = data.positions.length;
  if (n === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = data.positions[i];
    const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/** Midpoint of a bounding box. */
export function cloudCenter(cloud: Bounds): { x: number; y: number } {
  return { x: (cloud.minX + cloud.maxX) / 2, y: (cloud.minY + cloud.maxY) / 2 };
}

export interface FitFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The largest camera zoom at which the whole `cloud` box, padded by `margin`
 * of its own size on each side, fits inside `frustum`. Used to frame the
 * overview camera on load so the entire album cloud is visible (task 8 fix
 * round 2): the previous fixed initial zoom (2.4) combined with a
 * median-snap-only initial position showed only a corner of the cloud once
 * the full, unsampled dataset landed (positions span roughly [-1.68, 0.26] x
 * [-1.23, 0.18] at the balanced stop, far wider than the 2.4x frustum).
 */
export function fitZoom(cloud: Bounds, frustum: FitFrustum, margin = 0.08): number {
  // Guard against a degenerate (zero-size) cloud so a single-point dataset
  // never divides by zero; never hit by the real album data.
  const width = Math.max(cloud.maxX - cloud.minX, 1e-6);
  const height = Math.max(cloud.maxY - cloud.minY, 1e-6);
  const paddedWidth = width * (1 + 2 * margin);
  const paddedHeight = height * (1 + 2 * margin);
  const zoomX = (frustum.right - frustum.left) / paddedWidth;
  const zoomY = (frustum.top - frustum.bottom) / paddedHeight;
  return Math.min(zoomX, zoomY);
}

export interface ViewportWorldRect {
  halfW: number;
  halfH: number;
}

export interface OrthoFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
  zoom: number;
}

/**
 * Half-width/half-height of the visible viewport, in the same world units as
 * the camera's own frustum and `getMainBounds`'s box. `THREE.Viewport`'s
 * `getCurrentViewport` is built for perspective cameras and returns figures
 * in the wrong scale for this manual orthographic camera, which was the root
 * cause of `CameraBounds` treating an in-view album cloud as "off screen".
 * The correct figure is just the frustum size scaled down by zoom.
 */
export function viewportWorldRect(cam: OrthoFrustum): ViewportWorldRect {
  return {
    halfW: (cam.right - cam.left) / (2 * cam.zoom),
    halfH: (cam.top - cam.bottom) / (2 * cam.zoom),
  };
}

// Below this fraction of the cloud's bounding-box area actually inside the
// viewport, the idle camera is considered to have wandered off the cloud and
// gets nudged back. Above it (including "zoomed out enough to see the whole
// cloud at once"), the camera is left alone: seeing all of it, or panning to
// an edge region, is not a bug to correct.
export const VISIBLE_FRACTION_THRESHOLD = 0.25;

/**
 * Decides whether the idle camera should be nudged back toward the album
 * cloud, and by how much. Returns `null` when no correction is needed: the
 * cloud's bounding box is at least `VISIBLE_FRACTION_THRESHOLD` visible in
 * the viewport (by area), or the camera is already sitting at the clamp
 * target. Otherwise returns the raw (un-eased) correction vector; the caller
 * eases into it rather than snapping.
 */
export function nudgeVector(
  camPos: { x: number; y: number },
  viewport: ViewportWorldRect,
  cloud: Bounds,
  margin: number,
): { x: number; y: number } | null {
  const { halfW, halfH } = viewport;
  const cloudW = cloud.maxX - cloud.minX;
  const cloudH = cloud.maxY - cloud.minY;
  if (cloudW <= 0 || cloudH <= 0) return null;

  const viewMinX = camPos.x - halfW;
  const viewMaxX = camPos.x + halfW;
  const viewMinY = camPos.y - halfH;
  const viewMaxY = camPos.y + halfH;

  const overlapW = Math.max(0, Math.min(viewMaxX, cloud.maxX) - Math.max(viewMinX, cloud.minX));
  const overlapH = Math.max(0, Math.min(viewMaxY, cloud.maxY) - Math.max(viewMinY, cloud.minY));
  const visibleFraction = (overlapW * overlapH) / (cloudW * cloudH);

  if (visibleFraction >= VISIBLE_FRACTION_THRESHOLD) return null;

  // Clamp the camera so the viewport sits over the margin-padded cloud box.
  // When the viewport is wider/taller than the box (zoomed out far enough
  // that the whole cloud already fits), the range would invert; fall back to
  // centering on the box midpoint. This branch is a safety net, not the
  // common path: a viewport that large almost always already clears the
  // visibleFraction gate above and returns null before reaching here.
  const loX = cloud.minX - margin + halfW;
  const hiX = cloud.maxX + margin - halfW;
  const tx = loX <= hiX ? Math.max(loX, Math.min(hiX, camPos.x)) : (cloud.minX + cloud.maxX) / 2;
  const loY = cloud.minY - margin + halfH;
  const hiY = cloud.maxY + margin - halfH;
  const ty = loY <= hiY ? Math.max(loY, Math.min(hiY, camPos.y)) : (cloud.minY + cloud.maxY) / 2;

  const dx = tx - camPos.x;
  const dy = ty - camPos.y;
  // Below this squared distance the camera is already effectively at the
  // clamp target (floating-point noise, not a real correction).
  if (dx * dx + dy * dy < 1e-12) return null;
  return { x: dx, y: dy };
}
