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
  /**
   * The published overview framing (state/view.ts): the percentile cloud
   * bounds, their midpoint and the fitted zoom. Verification-only: after
   * load, getCameraState() should equal { ...center, zoom: fitZoom }.
   */
  getFitState?(): {
    center: { x: number; y: number };
    fitZoom: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  };
  /**
   * Fraction of all albums whose current position projects inside NDC
   * [-1, 1] on both axes through the live camera. Verification-only.
   */
  getNdcInsideFraction?(): number | null;
  /**
   * performance.now() timestamp of the first time AlbumField rendered with
   * real data, i.e. the first frame where dots could plausibly be on screen.
   * Used by the Fast-3G first-draw verification script (task 9); set once by
   * markFirstDraw() below, not part of the getters DebugExpose registers.
   */
  firstDrawAt?: number;
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
  // Merge rather than overwrite: markFirstDraw() below may have already set
  // firstDrawAt on window.__mapDebug before this effect runs (render order
  // is not guaranteed relative to markFirstDraw's call site), and a plain
  // overwrite here would erase it.
  window.__mapDebug = { ...window.__mapDebug, ...getters };
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

/**
 * Records performance.now() the first time AlbumField renders with data.
 * No-op after the first call. Unlike the other window.__mapDebug getters
 * (which expose live camera/store control surface and stay dev-only), this
 * is a single inert timestamp with no command surface, so it stays available
 * in production builds too. It is the only way to measure real first-draw
 * latency (perf audit / spec 4.5, "first map paint under 1.5s") since a dev
 * build's unbundled, uncompressed chunks are not representative of it.
 */
export function markFirstDraw(): void {
  if (typeof window === "undefined") return;
  if (!window.__mapDebug) window.__mapDebug = {} as DebugGetters;
  if (window.__mapDebug.firstDrawAt !== undefined) return;
  window.__mapDebug.firstDrawAt = performance.now();
}
