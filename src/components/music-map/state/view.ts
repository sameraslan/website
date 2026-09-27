import { TUNING } from "./tuning";

/**
 * The fitted "whole cloud visible" camera framing: the zoom at which the
 * entire album cloud fits the frustum with margin (state/bounds.ts's
 * fitZoom), and the world-space centre it should be framed around
 * (cloudCenter). Computed once positions load and recomputed (without
 * moving the camera) whenever sliderT changes, since each slider stop has
 * its own extent.
 *
 * Plain module-level bridge, not Zustand state, mirroring state/invalidate.ts
 * and state/tooltipEl.ts: CameraRig reads the current zoom synchronously
 * inside wheel-event handlers and per-frame closures (for its dynamic
 * MIN_ZOOM), not through a React subscription.
 *
 * `TUNING.overviewZoom` is only the fallback used before the first real
 * computation lands (i.e. before any MapData has loaded).
 */
export interface OverviewFraming {
  zoom: number;
  center: { x: number; y: number };
}

let framing: OverviewFraming = {
  zoom: TUNING.overviewZoom,
  center: { x: 0, y: 0 },
};

export function setOverviewFraming(next: OverviewFraming): void {
  framing = next;
}

export function getOverviewFraming(): OverviewFraming {
  return framing;
}
