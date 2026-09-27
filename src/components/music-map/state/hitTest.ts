/** Hover and click radius for a mouse, in CSS px (spec 4.4.3). */
export const MOUSE_HIT_RADIUS_CSS_PX = 14;
/** Tap radius for touch and pen, in CSS px: a fingertip is far less precise
 * than a cursor, so taps get a larger target. */
export const TOUCH_HIT_RADIUS_CSS_PX = 24;

/** Hit radius in CSS px for a PointerEvent's `pointerType`. */
export function hitRadiusCssPx(pointerType: string): number {
  return pointerType === "mouse" ? MOUSE_HIT_RADIUS_CSS_PX : TOUCH_HIT_RADIUS_CSS_PX;
}

/**
 * Converts a length in CSS px to world units under an orthographic camera:
 * one world unit spans `zoom * viewportHeightCssPx / frustumHeight` CSS px,
 * where `frustumHeight` is `camera.top - camera.bottom`. Shared by hover
 * (CursorTracker) and click/tap (FocusController) so both use the same
 * on-screen radius at every zoom.
 */
export function cssPxToWorld(
  px: number,
  viewportHeightCssPx: number,
  zoom: number,
  frustumHeight: number,
): number {
  return px / ((zoom * viewportHeightCssPx) / frustumHeight);
}

/**
 * O(n) nearest-point hit test over a flat, interleaved [x0,y0,x1,y1,...]
 * position array. Used by CursorTracker once per rendered frame and by
 * FocusController on each tap, against the
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
