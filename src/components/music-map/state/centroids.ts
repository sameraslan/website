/**
 * Per-cluster mean position, recomputed whenever `positionsRef` is rebuilt
 * (i.e. on a sliderT change, see AlbumField.tsx). Used by the region-labels
 * driver (canvas/RegionLabels.tsx) to place each region's label at the
 * centroid of its members at the current slider position, instead of the
 * static centroid baked into regions.json (which only reflects one stop).
 */

/**
 * Returns the mean [x, y] of each cluster's member positions, flattened as
 * `[x0, y0, x1, y1, ..., x(k-1), y(k-1)]`.
 *
 * `positions` is a flat `[x0, y0, x1, y1, ...]` array of `n` points;
 * `clusterIds[i]` gives the cluster (0..k-1) that point `i` belongs to. A
 * cluster with zero members gets `NaN` for both coordinates so callers (the
 * label driver) can hide that label rather than drawing it at the origin.
 */
export function clusterCentroids(
  positions: Float32Array,
  clusterIds: Uint8Array,
  n: number,
  k: number,
): Float32Array {
  const sums = new Float64Array(k * 2);
  const counts = new Float64Array(k);

  for (let i = 0; i < n; i++) {
    const c = clusterIds[i];
    if (c < 0 || c >= k) continue;
    sums[c * 2] += positions[i * 2];
    sums[c * 2 + 1] += positions[i * 2 + 1];
    counts[c] += 1;
  }

  const out = new Float32Array(k * 2);
  for (let c = 0; c < k; c++) {
    if (counts[c] === 0) {
      out[c * 2] = NaN;
      out[c * 2 + 1] = NaN;
    } else {
      out[c * 2] = sums[c * 2] / counts[c];
      out[c * 2 + 1] = sums[c * 2 + 1] / counts[c];
    }
  }
  return out;
}

/**
 * Member count per cluster, indexed by clusterId. Membership doesn't change
 * with sliderT (it's a fixed assignment from the data pipeline), so this is
 * computed once per data load, not per slider change, unlike
 * `clusterCentroids`. Used to hide region labels for clusters too small to
 * mean anything (task 8 fix round 2): with the real dataset, 5 of 8
 * clusters have 1 to 3 members each, so their "region" label is misleading.
 */
export function clusterMemberCounts(clusterIds: Uint8Array, n: number, k: number): Uint32Array {
  const counts = new Uint32Array(k);
  for (let i = 0; i < n; i++) {
    const c = clusterIds[i];
    if (c < 0 || c >= k) continue;
    counts[c] += 1;
  }
  return counts;
}
