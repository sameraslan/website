import { describe, expect, it } from "vitest";

import { nearestWithin } from "./hitTest";

describe("nearestWithin", () => {
  it("returns the closest index inside the radius", () => {
    const positions = new Float32Array([0, 0, 1, 0, 2, 0]);
    expect(nearestWithin(positions, 3, 0.9, 0, 0.5)).toBe(1);
  });

  it("returns -1 when nothing is within the radius", () => {
    const positions = new Float32Array([0, 0, 5, 5]);
    expect(nearestWithin(positions, 2, 10, 10, 0.5)).toBe(-1);
  });

  it("returns -1 exactly at the radius boundary (strict inside only)", () => {
    const positions = new Float32Array([0, 0]);
    expect(nearestWithin(positions, 1, 1, 0, 1)).toBe(-1);
  });

  it("picks the first index on a tie", () => {
    // (1,0) and (-1,0) are both distance 1 from the origin.
    const positions = new Float32Array([1, 0, -1, 0]);
    expect(nearestWithin(positions, 2, 0, 0, 2)).toBe(0);
  });

  it("only considers the first n points even if the array is longer", () => {
    const positions = new Float32Array([10, 10, 0, 0]);
    expect(nearestWithin(positions, 1, 0, 0, 1)).toBe(-1);
  });
});
