import { describe, expect, it } from "vitest";

import { SIZE_CURVE_POWER, spriteCssSize } from "./album";

describe("spriteCssSize (JS mirror of the vertex shader's size curve)", () => {
  it("is 10px at the fitted overview zoom", () => {
    expect(spriteCssSize(1.007, 1.007)).toBeCloseTo(10, 10);
  });

  it("is at least 60px at focus zoom 4 with the real fit (~1.007)", () => {
    const s = spriteCssSize(4, 1.007);
    expect(s).toBeCloseTo(10 * Math.pow(4 / 1.007, SIZE_CURVE_POWER), 10);
    expect(s).toBeGreaterThanOrEqual(60);
  });

  it("clamps to [4, 90]", () => {
    expect(spriteCssSize(0.01, 1)).toBe(4);
    expect(spriteCssSize(50, 1)).toBe(90);
  });

  it("guards a zero fit zoom like the shader's max(u_fitZoom, 0.0001)", () => {
    expect(spriteCssSize(1, 0)).toBe(90);
  });
});
