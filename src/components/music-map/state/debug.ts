/**
 * Tiny test hook for Playwright/UI-check harnesses. Only registers a global in
 * non-production builds, so the cost in production is zero (the call is a
 * no-op and the getters object is never retained).
 */
export interface DebugCameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface DebugGetters {
  getCameraState(): DebugCameraState;
  /**
   * World position ({x, y}) of the currently focused album at the current
   * sliderT, or null if nothing is focused. Used by fix-verification scripts
   * to check the camera hasn't desynced from the focused album after a
   * slider change; not needed by the app itself.
   */
  getFocusedAlbumPos?(): { x: number; y: number } | null;
  /** Current sliderT. Verification-only, mirrors the debug getters above. */
  getSliderT?(): number;
  /**
   * Viewport (screen) coordinates of a real album's current position, for
   * Playwright to dispatch synthetic pointer events at a coordinate
   * guaranteed to land on an album dot. Verification-only.
   */
  getNearestScreenPoint?(): { x: number; y: number } | null;
  /**
   * World coordinates under a client (viewport) point, using the live camera
   * and the same screen-to-world conversion CursorTracker uses. Lets
   * Playwright verify cursor-anchored zoom keeps a screen point's world
   * position fixed across a zoom change.
   */
  getWorldAt?(clientX: number, clientY: number): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __mapDebug?: DebugGetters;
    /**
     * Dev-only counter of SceneInner React commits. Bumped once per commit
     * from a no-deps useEffect in Scene.tsx. Used by
     * scripts/ui-check/profile-moves.mjs to verify pointermove no longer
     * triggers React re-renders inside the canvas tree once cursor/zoom
     * state moves to refs (see docs/superpowers/sdd task-5).
     */
    __mapCommits?: number;
  }
}

export function registerDebug(getters: DebugGetters): () => void {
  if (process.env.NODE_ENV === "production") return () => {};
  if (typeof window === "undefined") return () => {};
  window.__mapDebug = getters;
  return () => {
    delete window.__mapDebug;
  };
}

/** Bumps the dev-only commit counter. No-op in production. */
export function bumpCommitCounter(): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;
  window.__mapCommits = (window.__mapCommits ?? 0) + 1;
}
