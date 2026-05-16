import { describe, expect, it } from "vitest";

import { easeOutCubic, interpolatePosition, kNearestNeighbors } from "./projection";

describe("interpolatePosition", () => {
  const audio: [number, number] = [0, 0];
  const balanced: [number, number] = [10, 0];
  const mood: [number, number] = [10, 10];

  it("returns audio at t=0", () => {
    expect(interpolatePosition(audio, balanced, mood, 0)).toEqual([0, 0]);
  });
  it("returns balanced at t=0.5", () => {
    expect(interpolatePosition(audio, balanced, mood, 0.5)).toEqual([10, 0]);
  });
  it("returns mood at t=1", () => {
    expect(interpolatePosition(audio, balanced, mood, 1)).toEqual([10, 10]);
  });
  it("interpolates linearly in the lower half", () => {
    expect(interpolatePosition(audio, balanced, mood, 0.25)).toEqual([5, 0]);
  });
  it("interpolates linearly in the upper half", () => {
    expect(interpolatePosition(audio, balanced, mood, 0.75)).toEqual([10, 5]);
  });
});

describe("easeOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("is monotonic and decelerates", () => {
    const a = easeOutCubic(0.25);
    const b = easeOutCubic(0.75);
    expect(b).toBeGreaterThan(a);
    // ease-out: second-half gain is smaller than first-half gain
    const firstHalfGain = easeOutCubic(0.5) - easeOutCubic(0);
    const secondHalfGain = easeOutCubic(1) - easeOutCubic(0.5);
    expect(secondHalfGain).toBeLessThan(firstHalfGain);
  });
});

describe("kNearestNeighbors", () => {
  it("returns the K closest by 2D euclidean distance, excluding the target", () => {
    const positions = new Map<string, [number, number]>([
      ["a", [0, 0]],
      ["b", [1, 0]],
      ["c", [0, 5]],
      ["d", [10, 10]],
      ["e", [0.5, 0]],
    ]);
    const neighbors = kNearestNeighbors("a", positions, 2);
    expect(neighbors).toEqual(["e", "b"]);
  });
});
