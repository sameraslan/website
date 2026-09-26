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
