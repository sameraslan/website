import { describe, expect, it } from "vitest";

import { clusterCentroids } from "./centroids";

describe("clusterCentroids", () => {
  it("computes the mean x,y per cluster", () => {
    // Two clusters: cluster 0 has points (0,0) and (2,2) -> mean (1,1).
    // Cluster 1 has a single point (10,-4) -> mean (10,-4).
    const positions = new Float32Array([0, 0, 2, 2, 10, -4]);
    const clusterIds = new Uint8Array([0, 0, 1]);
    const out = clusterCentroids(positions, clusterIds, 3, 2);
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(1, 10);
    expect(out[1]).toBeCloseTo(1, 10);
    expect(out[2]).toBeCloseTo(10, 10);
    expect(out[3]).toBeCloseTo(-4, 10);
  });

  it("gives NaN for a cluster with no members", () => {
    const positions = new Float32Array([1, 1, 3, 3]);
    const clusterIds = new Uint8Array([0, 0]);
    const out = clusterCentroids(positions, clusterIds, 2, 3);
    expect(out.length).toBe(6);
    expect(out[0]).toBeCloseTo(2, 10);
    expect(out[1]).toBeCloseTo(2, 10);
    expect(Number.isNaN(out[2])).toBe(true);
    expect(Number.isNaN(out[3])).toBe(true);
    expect(Number.isNaN(out[4])).toBe(true);
    expect(Number.isNaN(out[5])).toBe(true);
  });

  it("returns an empty array for k=0", () => {
    const out = clusterCentroids(new Float32Array(0), new Uint8Array(0), 0, 0);
    expect(out.length).toBe(0);
  });
});
