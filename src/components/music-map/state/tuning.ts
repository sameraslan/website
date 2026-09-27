/**
 * Fixed tuning constants for the map's camera and drift behavior. There is a
 * single preset (no dev HUD, no AnimMode switching, no auto-tour): these
 * values are the product decision, not a starting point for experimentation.
 */
export const TUNING = {
  driftAmplitude: 0.08,
  driftFreqHz: 1 / 8,
  driftIdleDelayMs: 10_000,
  overviewZoom: 2.4,
  focusZoom: 4.0,
  focusFlyDurationMs: 550,
  focusReleaseDurationMs: 320,
} as const;
