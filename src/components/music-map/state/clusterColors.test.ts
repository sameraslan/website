import { describe, expect, it } from "vitest";

import { clusterColorsFromRegions, hexToRgb01 } from "./clusterColors";

describe("hexToRgb01", () => {
  it("parses #rrggbb into 0..1 floats", () => {
    const [r, g, b] = hexToRgb01("#b6532a");
    expect(r).toBeCloseTo(0xb6 / 255, 10);
    expect(g).toBeCloseTo(0x53 / 255, 10);
    expect(b).toBeCloseTo(0x2a / 255, 10);
  });
});

describe("clusterColorsFromRegions", () => {
  it("orders colours by clusterId, not by array order", () => {
    const out = clusterColorsFromRegions(
      [
        { clusterId: 1, color: "#000000" },
        { clusterId: 0, color: "#ffffff" },
      ],
      2,
    );
    expect(out[0]).toEqual([1, 1, 1]);
    expect(out[1]).toEqual([0, 0, 0]);
  });

  it("always returns `count` entries, padding with the last colour", () => {
    const out = clusterColorsFromRegions(
      [
        { clusterId: 0, color: "#ff0000" },
        { clusterId: 1, color: "#00ff00" },
      ],
      8,
    );
    expect(out.length).toBe(8);
    expect(out[1]).toEqual([0, 1, 0]);
    expect(out[7]).toEqual([0, 1, 0]);
  });

  it("falls back to neutral grey entries when there are no regions", () => {
    const out = clusterColorsFromRegions([], 3);
    expect(out.length).toBe(3);
    expect(out[0][0]).toBeCloseTo(0.5, 10);
  });
});
