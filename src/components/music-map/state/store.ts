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
  /**
   * Last timestamp (ms) the user actually grabbed the camera: pointerdown
   * that starts a drag, or wheel zoom only (not a slider drag). Hover/
   * pointermove alone never sets this. `FlyToFocus` only cancels its glide
   * against this timestamp, so an idle mouse twitch after a click can't
   * kill the fly-to.
   */
  lastCameraGrab: number;

  setData(data: import("../data/types").MapData): void;
  setMode(mode: MapMode): void;
  focus(id: string | null): void;
  setSliderT(t: number): void;
  registerInteraction(): void;
  registerCameraGrab(): void;
}

const STORAGE_KEY = "music-map:state";

// Fresh sessions start biased 10% toward mood (0.6 on the audio→mood axis)
// rather than dead-centre balanced.
const DEFAULT_SLIDER_T = 0.6;

// Only sliderT is persisted. focusedId is intentionally NOT restored: it is
// transient per-visit state, and restoring it would reopen the page pinned to
// whatever album was last focused rather than framed on the dense centre of
// the cloud (see FlyToFocus's initial-centering logic).
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

const SAVE_DEBOUNCE_MS = 250;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveToSession(state: { sliderT: number }) {
  if (typeof window === "undefined") return;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, SAVE_DEBOUNCE_MS);
}

export const useMapStore = create<MapStore>()(
  subscribeWithSelector((set, get) => ({
    mode: "loading",
    data: null,
    focusedId: null,
    sliderT: loadFromSession().sliderT ?? DEFAULT_SLIDER_T,
    lastInteraction: 0,
    lastCameraGrab: 0,

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
    registerCameraGrab: () => set({ lastCameraGrab: Date.now() }),
  })),
);

export const STOP_T: Record<SliderStopId, number> = {
  audio: 0,
  balanced: 0.5,
  mood: 1,
};
