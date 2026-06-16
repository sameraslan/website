import { create } from "zustand";

export type AnimMode = "near-focus" | "free-wander" | "slow-tour" | "pan-loop";

export interface TuningParams {
  driftAmplitude: number;
  driftFreqHz: number;
  driftIdleDelayMs: number;
  orbitEnabled: boolean;
  orbitRadius: number;
  orbitFreqHz: number;
  tourEnabled: boolean;
  tourNearbyOnly: boolean;
  tourIdleDelayMs: number;
  tourHoldMs: number;
  tourPauseMs: number;
  tourNearbyRadius: number;
  overviewZoom: number;
  focusZoom: number;
  focusFlyDurationMs: number;
  focusReleaseDurationMs: number;
}

export const PRESETS: Record<AnimMode, TuningParams> = {
  "near-focus": {
    driftAmplitude: 0.08,
    driftFreqHz: 1 / 8,
    // Auto-motion only kicks in after the user has been idle this long (pointer
    // off the canvas or held still). Any pan/drag/zoom/cursor-move re-arms it.
    driftIdleDelayMs: 5_000,
    // orbitRadius / orbitFreqHz drive the slow circle AmbientDrift traces
    // around an album once the glide lands (independent of orbitEnabled, which
    // only toggles the overview-drift orbit). ~1 revolution per 8s, small
    // enough to keep the album framed at focusZoom.
    orbitEnabled: false,
    orbitRadius: 0.07,
    orbitFreqHz: 1 / 12,
    tourEnabled: true,
    tourNearbyOnly: true,
    tourIdleDelayMs: 5_000,
    // Covers the curved glide (focusFlyDurationMs ~6s) plus ~28.5s of slow
    // circling around the album before gliding to the next one.
    tourHoldMs: 34_500,
    tourPauseMs: 3_000,
    tourNearbyRadius: 0.95,
    overviewZoom: 2.4,
    focusZoom: 3.4,
    focusFlyDurationMs: 6_000,
    focusReleaseDurationMs: 900,
  },
  "free-wander": {
    driftAmplitude: 0.55,
    driftFreqHz: 1 / 32,
    driftIdleDelayMs: 1_500,
    orbitEnabled: false,
    orbitRadius: 0.4,
    orbitFreqHz: 1 / 60,
    tourEnabled: false,
    tourNearbyOnly: true,
    tourIdleDelayMs: 5_000,
    tourHoldMs: 3_000,
    tourPauseMs: 6_000,
    tourNearbyRadius: 0.45,
    overviewZoom: 2.2,
    focusZoom: 3.2,
    focusFlyDurationMs: 1_200,
    focusReleaseDurationMs: 900,
  },
  "slow-tour": {
    driftAmplitude: 0.18,
    driftFreqHz: 1 / 40,
    driftIdleDelayMs: 2_000,
    orbitEnabled: false,
    orbitRadius: 0.4,
    orbitFreqHz: 1 / 60,
    tourEnabled: true,
    tourNearbyOnly: false,
    tourIdleDelayMs: 2_500,
    tourHoldMs: 2_500,
    tourPauseMs: 1_500,
    tourNearbyRadius: 0.45,
    overviewZoom: 2.0,
    // Equal to overviewZoom → no zoom-in on focus, just glide between albums.
    focusZoom: 2.0,
    focusFlyDurationMs: 4_500,
    focusReleaseDurationMs: 800,
  },
  "pan-loop": {
    driftAmplitude: 0.0,
    driftFreqHz: 1 / 26,
    driftIdleDelayMs: 1_500,
    orbitEnabled: true,
    orbitRadius: 0.45,
    orbitFreqHz: 1 / 70,
    tourEnabled: false,
    tourNearbyOnly: true,
    tourIdleDelayMs: 4_500,
    tourHoldMs: 3_500,
    tourPauseMs: 7_000,
    tourNearbyRadius: 0.45,
    overviewZoom: 2.4,
    focusZoom: 3.4,
    focusFlyDurationMs: 1_200,
    focusReleaseDurationMs: 900,
  },
};

interface TuningStore extends TuningParams {
  hudOpen: boolean;
  mode: AnimMode;
  setHudOpen: (b: boolean) => void;
  setMode: (m: AnimMode) => void;
  setParam: <K extends keyof TuningParams>(k: K, v: TuningParams[K]) => void;
  resetToMode: () => void;
}

export const useTuningStore = create<TuningStore>((set, get) => ({
  ...PRESETS["near-focus"],
  hudOpen: false,
  mode: "near-focus",
  setHudOpen: (b) => set({ hudOpen: b }),
  setMode: (m) => set({ mode: m, ...PRESETS[m] }),
  setParam: (k, v) => set({ [k]: v } as Pick<TuningParams, typeof k>),
  resetToMode: () => set({ ...PRESETS[get().mode] }),
}));

if (typeof window !== "undefined") {
  (window as unknown as { __tune: typeof useTuningStore }).__tune = useTuningStore;
}
