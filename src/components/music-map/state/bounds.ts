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
