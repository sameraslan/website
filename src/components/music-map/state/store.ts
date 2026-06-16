import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type { SliderStopId } from "../data/types";

export type MapMode = "loading" | "idle" | "interactive" | "focus";

export interface MapStore {
  mode: MapMode;
  data: import("../data/types").MapData | null;
  focusedId: string | null;
  /** sliderT ∈ [0, 1]: 0 = pure audio, 0.5 = balanced, 1 = pure mood. */
  sliderT: number;
  /** Last interaction timestamp (ms). Used to gate idle drift. */
  lastInteraction: number;

  setData(data: import("../data/types").MapData): void;
  setMode(mode: MapMode): void;
  focus(id: string | null): void;
  setSliderT(t: number): void;
  registerInteraction(): void;
}

const STORAGE_KEY = "music-map:state";

// Fresh sessions start biased 10% toward mood (0.6 on the audio→mood axis)
// rather than dead-centre balanced.
const DEFAULT_SLIDER_T = 0.6;

// Only sliderT is persisted. focusedId is intentionally NOT restored: it is a
// transient auto-tour artifact (the tour rewrites it every few seconds), so
// restoring it would reopen the page centered on whatever album the tour
// happened to land on last — often an edge album — leaving the cloud off in a
// corner. The page must always open framed on the dense centre of the cloud.
function loadFromSession(): Partial<Pick<MapStore, "sliderT">> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      sliderT:
        typeof parsed.sliderT === "number" ? parsed.sliderT : DEFAULT_SLIDER_T,
    };
  } catch {
    return {};
  }
}

function saveToSession(state: { sliderT: number }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export const useMapStore = create<MapStore>()(
  subscribeWithSelector((set, get) => ({
    mode: "loading",
    data: null,
    focusedId: null,
    sliderT: loadFromSession().sliderT ?? DEFAULT_SLIDER_T,
    lastInteraction: 0,

    setData: (data) => set({ data, mode: "idle" }),
    setMode: (mode) => set({ mode }),
    focus: (id) => {
      const next = id === null ? "idle" : "focus";
      set({ focusedId: id, mode: next });
    },
    setSliderT: (t) => {
      const clamped = Math.max(0, Math.min(1, t));
      set({ sliderT: clamped });
      saveToSession({ sliderT: clamped });
    },
    registerInteraction: () => set({ lastInteraction: Date.now() }),
  })),
);

// Expose the store on `window` for QA harnesses and devtools introspection.
// No-op in SSR. Production bundles still include this — the cost is one
// global assignment at module load.
if (typeof window !== "undefined") {
  (window as unknown as { __mapStore: typeof useMapStore }).__mapStore = useMapStore;
}

export const STOP_T: Record<SliderStopId, number> = {
  audio: 0,
  balanced: 0.5,
  mood: 1,
};
