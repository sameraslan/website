import { describe, expect, it } from "vitest";

import { renderedSpriteCssSize, SIZE_CURVE_POWER, spriteCssSize } from "./album";

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

describe("renderedSpriteCssSize (size curve plus the shader's device-px caps)", () => {
  it("matches the curve when no cap applies", () => {
    expect(renderedSpriteCssSize(1, 1, 900, 1)).toBeCloseTo(10, 10);
  });

  it("applies the 18%-of-viewport cap after the per-instance scale", () => {
    // 90px * 1.25 = 112.5px, capped at 0.18 * 500 = 90px.
    expect(renderedSpriteCssSize(50, 1, 500, 1, 1.25)).toBeCloseTo(90, 10);
  });

  it("applies the 240 device-px cap on a high-dpr screen", () => {
    // 90px * 1.25 * dpr 3 = 337.5 device px, capped at 240 -> 80 CSS px.
    expect(renderedSpriteCssSize(50, 1, 2000, 3, 1.25)).toBeCloseTo(80, 10);
  });
});
