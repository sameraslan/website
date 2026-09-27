import { describe, expect, it } from "vitest";

import { clusterMedians, clusterMemberCounts } from "./centroids";

describe("clusterMedians", () => {
  it("averages the two middle values for an even-sized cluster", () => {
    // Cluster 0 has points (0,0) and (2,2) -> median (1,1).
    // Cluster 1 has a single point (10,-4) -> median (10,-4).
    const positions = new Float32Array([0, 0, 2, 2, 10, -4]);
    const clusterIds = new Uint8Array([0, 0, 1]);
    const out = clusterMedians(positions, clusterIds, 3, 2);
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(1, 10);
    expect(out[1]).toBeCloseTo(1, 10);
    expect(out[2]).toBeCloseTo(10, 10);
    expect(out[3]).toBeCloseTo(-4, 10);
  });

  it("is not dragged by an outlier the way a mean would be", () => {
    // xs sorted 0,1,2,3,100 -> 2; ys sorted -100,0,1,2,3 -> 1. The mean
    // would be (21.2, -18.8), far outside the four clustered points.
    const positions = new Float32Array([0, 0, 1, 1, 2, 2, 3, 3, 100, -100]);
    const clusterIds = new Uint8Array([0, 0, 0, 0, 0]);
    const out = clusterMedians(positions, clusterIds, 5, 1);
    expect(out[0]).toBeCloseTo(2, 10);
    expect(out[1]).toBeCloseTo(1, 10);
  });

  it("gives NaN for a cluster with no members", () => {
    const positions = new Float32Array([1, 1, 3, 3]);
    const clusterIds = new Uint8Array([0, 0]);
    const out = clusterMedians(positions, clusterIds, 2, 3);
    expect(out.length).toBe(6);
    expect(out[0]).toBeCloseTo(2, 10);
    expect(out[1]).toBeCloseTo(2, 10);
    expect(Number.isNaN(out[2])).toBe(true);
    expect(Number.isNaN(out[3])).toBe(true);
    expect(Number.isNaN(out[4])).toBe(true);
    expect(Number.isNaN(out[5])).toBe(true);
  });

  it("returns an empty array for k=0", () => {
    const out = clusterMedians(new Float32Array(0), new Uint8Array(0), 0, 0);
    expect(out.length).toBe(0);
  });
});

describe("clusterMemberCounts", () => {
  it("counts members per cluster, including small and empty clusters", () => {
    // Mirrors the real dataset's shape: a couple of large clusters and
    // several with only a handful of members.
    const clusterIds = new Uint8Array([0, 0, 0, 1, 1, 2]);
    const counts = clusterMemberCounts(clusterIds, 6, 4);
    expect(Array.from(counts)).toEqual([3, 2, 1, 0]);
  });

  it("returns all zeros for n=0", () => {
    const counts = clusterMemberCounts(new Uint8Array(0), 0, 3);
    expect(Array.from(counts)).toEqual([0, 0, 0]);
  });
});
