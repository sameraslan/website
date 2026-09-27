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
}

declare global {
  interface Window {
    __mapDebug?: DebugGetters;
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
