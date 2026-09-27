/**
 * Pure math for cursor-anchored zoom (spec 4.4.4). The orthographic camera
 * projects a world point to screen offset from centre as
 * `(world - cameraPos) * zoom` (in the camera's frustum units), so keeping a
 * world point fixed on screen across a zoom change means solving for the new
 * camera position that preserves that projection.
 */

export interface CameraLike {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Returns the camera position that keeps `cursorWorld` projecting to the
 * same screen point after the camera's zoom changes from `cam.zoom` to
 * `nextZoom`.
 *
 * Derivation: projection is invariant when
 * `(cursorWorld - newPos) * nextZoom === (cursorWorld - cam) * cam.zoom`,
 * so `newPos = cursorWorld - (cursorWorld - cam) * (cam.zoom / nextZoom)`.
 */
export function anchoredZoom(
  cam: CameraLike,
  cursorWorld: [number, number],
  nextZoom: number,
): { x: number; y: number } {
  const ratio = cam.zoom / nextZoom;
  return {
    x: cursorWorld[0] - (cursorWorld[0] - cam.x) * ratio,
    y: cursorWorld[1] - (cursorWorld[1] - cam.y) * ratio,
  };
}
