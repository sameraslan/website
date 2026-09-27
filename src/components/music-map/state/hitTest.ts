/**
 * O(n) nearest-point hit test over a flat, interleaved [x0,y0,x1,y1,...]
 * position array. Used by CursorTracker on every pointermove against the
 * current interpolated positions AlbumField maintains (see AlbumField.tsx),
 * so it stays a typed-array scan rather than an array-of-objects walk.
 */
export function nearestWithin(
  positions: Float32Array,
  n: number,
  x: number,
  y: number,
  radiusWorld: number,
): number {
  let best = -1;
  let bestD2 = radiusWorld * radiusWorld;
  for (let i = 0; i < n; i++) {
    const dx = positions[i * 2] - x;
    const dy = positions[i * 2 + 1] - y;
    const d2 = dx * dx + dy * dy;
    // Strict less-than: on a tie the earlier index (already stored in
    // `best`) is kept, matching "ties pick the first" in the task brief.
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}
