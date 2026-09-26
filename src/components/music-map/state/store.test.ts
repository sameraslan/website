import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { useMapStore } from "./store";

describe("useMapStore", () => {
  beforeEach(() => {
    useMapStore.setState({
      mode: "loading",
      data: null,
      focusedId: null,
      sliderT: 0.5,
      lastInteraction: 0,
      lastCameraGrab: 0,
    });
  });

  it("setSliderT clamps to [0, 1]", () => {
    useMapStore.getState().setSliderT(1.5);
    expect(useMapStore.getState().sliderT).toBe(1);
    useMapStore.getState().setSliderT(-0.2);
    expect(useMapStore.getState().sliderT).toBe(0);
  });

  it("focus(id) transitions to focus mode and stores id", () => {
    useMapStore.getState().focus("spotify:album:abc");
    expect(useMapStore.getState().focusedId).toBe("spotify:album:abc");
    expect(useMapStore.getState().mode).toBe("focus");
  });

  it("focus(null) returns to idle mode", () => {
    useMapStore.getState().focus("spotify:album:abc");
    useMapStore.getState().focus(null);
    expect(useMapStore.getState().focusedId).toBeNull();
    expect(useMapStore.getState().mode).toBe("idle");
  });

  it("registerInteraction stamps lastInteraction", () => {
    const before = useMapStore.getState().lastInteraction;
    useMapStore.getState().registerInteraction();
    expect(useMapStore.getState().lastInteraction).toBeGreaterThan(before);
  });

  it("registerCameraGrab stamps lastCameraGrab and does not touch lastInteraction", () => {
    const beforeGrab = useMapStore.getState().lastCameraGrab;
    const beforeInteraction = useMapStore.getState().lastInteraction;
    useMapStore.getState().registerCameraGrab();
    expect(useMapStore.getState().lastCameraGrab).toBeGreaterThan(beforeGrab);
    expect(useMapStore.getState().lastInteraction).toBe(beforeInteraction);
  });

  describe("saveToSession debounce", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.sessionStorage.clear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("setSliderT called twice within 250ms writes sessionStorage once", () => {
      const spy = vi.spyOn(Storage.prototype, "setItem");
      useMapStore.getState().setSliderT(0.2);
      vi.advanceTimersByTime(100);
      useMapStore.getState().setSliderT(0.3);
      // Still within the 250ms debounce window (the second call restarts
      // the timer): nothing should have flushed yet.
      expect(spy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(spy).toHaveBeenCalledTimes(1);
      const raw = window.sessionStorage.getItem("music-map:state");
      expect(raw && JSON.parse(raw).sliderT).toBe(0.3);
      spy.mockRestore();
    });
  });
});
