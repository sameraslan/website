import { describe, expect, it, beforeEach } from "vitest";

import { useMapStore } from "./store";

describe("useMapStore", () => {
  beforeEach(() => {
    useMapStore.setState({
      mode: "loading",
      data: null,
      focusedId: null,
      sliderT: 0.5,
      lastInteraction: 0,
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
});
