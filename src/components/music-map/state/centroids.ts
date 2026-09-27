/**
 * Per-cluster label anchors, recomputed whenever `positionsRef` is rebuilt
 * (i.e. on a sliderT change, see AlbumField.tsx). Used by the region-labels
 * driver (canvas/RegionLabels.tsx) to place each region's label inside the
 * blob it names at the current slider position.
 */

function median(sorted: Float32Array): number {
  const m = sorted.length;
  const mid = m >> 1;
  return m % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Returns the per-axis median [x, y] of each cluster's member positions,
 * flattened as `[x0, y0, x1, y1, ..., x(k-1), y(k-1)]`.
 *
 * A median rather than a mean, and rather than a p2..p98 midpoint: the real
 * "ambient" cluster holds the dataset's far outlier group (about 8% of its
 * 1,092 members near x = -3.7 at sliderT 0.6), which drags its mean 0.11
 * world units off its blob and puts its p2..p98 midpoint at (-1.69, -0.92),
 * in empty space. The median stays inside the dense mass.
 *
 * `positions` is a flat `[x0, y0, x1, y1, ...]` array of `n` points;
 * `clusterIds[i]` gives the cluster (0..k-1) that point `i` belongs to. A
 * cluster with zero members gets `NaN` for both coordinates so callers (the
 * label driver) can hide that label rather than drawing it at the origin.
 */
export function clusterMedians(
  positions: Float32Array,
  clusterIds: Uint8Array,
  n: number,
  k: number,
): Float32Array {
  const counts = clusterMemberCounts(clusterIds, n, k);
  const xs = Array.from({ length: k }, (_, c) => new Float32Array(counts[c]));
  const ys = Array.from({ length: k }, (_, c) => new Float32Array(counts[c]));
  const fill = new Uint32Array(k);
  for (let i = 0; i < n; i++) {
    const c = clusterIds[i];
    if (c >= k) continue;
    const j = fill[c]++;
    xs[c][j] = positions[i * 2];
    ys[c][j] = positions[i * 2 + 1];
  }

  const out = new Float32Array(k * 2);
  for (let c = 0; c < k; c++) {
    if (counts[c] === 0) {
      out[c * 2] = NaN;
      out[c * 2 + 1] = NaN;
      continue;
    }
    out[c * 2] = median(xs[c].sort());
    out[c * 2 + 1] = median(ys[c].sort());
  }
  return out;
}

/**
 * Member count per cluster, indexed by clusterId. Membership doesn't change
 * with sliderT (it's a fixed assignment from the data pipeline), so this is
 * computed once per data load, not per slider change, unlike
 * `clusterMedians`. Used to hide region labels for clusters too small to
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
