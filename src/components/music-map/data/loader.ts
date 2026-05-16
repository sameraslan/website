import type { MapData, MetadataRecord, PositionRecord, RegionRecord, SliderStopId } from "./types";

/**
 * Temporary UX iteration knob: subsample the full album dataset down to this
 * many records so the cluster reads as an airy constellation rather than a
 * dense overdraw. Set to `Infinity` (or 0) to disable and render every album.
 *
 * Sampling is deterministic — ids are sorted lexicographically and we take a
 * uniform stride — so reloads always show the same 500. Once we're happy with
 * the density story this should be reverted to render the full set.
 */
const SAMPLE_LIMIT = 500;

export interface LoaderOptions {
  onProgress?: (phase: "fetching" | "parsed" | "atlas-0-ready") => void;
}

/**
 * Deterministic subsample: sort all album ids lexicographically and pick
 * every Nth so the chosen set is stable across reloads (no shuffle, no RNG).
 * Returns the set of kept ids; both positions.json and metadata.json are
 * filtered with this set so the two lists stay aligned.
 */
function pickSampledIds(positions: PositionRecord[], limit: number): Set<string> {
  if (!Number.isFinite(limit) || limit <= 0 || positions.length <= limit) {
    return new Set(positions.map((p) => p.id));
  }
  const ids = positions.map((p) => p.id).sort();
  const stride = ids.length / limit;
  const kept = new Set<string>();
  for (let i = 0; i < limit; i++) {
    const idx = Math.min(ids.length - 1, Math.floor(i * stride));
    kept.add(ids[idx]);
  }
  return kept;
}

/**
 * Normalize per-stop positions so the bulk (p2..p98) fills roughly [-0.7, 0.7]
 * on the larger axis while preserving aspect ratio (we use the same scale on
 * both axes per stop). Regions are normalized with the SAME transform so
 * region centroids/radii stay aligned with the dot field.
 *
 * Raw data has highly off-center distributions (e.g. balanced p50 ≈ (0.06,
 * -0.13) with full extent reaching x=-1.68, y=-1.23 due to a long tail of
 * outliers). Without normalization the visible bulk only fills ~25% of the
 * frustum and reads as a tight blob.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

interface StopTransform {
  cx: number;
  cy: number;
  scale: number;
}

function computeStopTransform(
  positions: PositionRecord[],
  stop: SliderStopId,
): StopTransform {
  const xs = positions.map((p) => p[stop][0]).sort((a, b) => a - b);
  const ys = positions.map((p) => p[stop][1]).sort((a, b) => a - b);
  // Center on the median (robust to skewed long tails — many stops have
  // outliers reaching x=-1.68 or y=-1.23 while the bulk sits near zero).
  const cx = percentile(xs, 0.5);
  const cy = percentile(ys, 0.5);
  // Scale from the p5..p95 spread around the median — this is the bulk we
  // want to fill the frustum with. Outliers land outside (but still inside
  // the camera frustum since we leave 30% headroom on each side).
  const x5 = percentile(xs, 0.05);
  const x95 = percentile(xs, 0.95);
  const y5 = percentile(ys, 0.05);
  const y95 = percentile(ys, 0.95);
  const halfW = Math.max(Math.abs(x95 - cx), Math.abs(cx - x5));
  const halfH = Math.max(Math.abs(y95 - cy), Math.abs(cy - y5));
  const halfMax = Math.max(halfW, halfH, 1e-6);
  // Map p5..p95 bulk (around the median) into ±0.55 of world space so the
  // ±0.75 frustum leaves ~25% paper margin around the dense mass.
  const scale = 0.55 / halfMax;
  return { cx, cy, scale };
}

function applyTransform(pt: [number, number], t: StopTransform): [number, number] {
  return [(pt[0] - t.cx) * t.scale, (pt[1] - t.cy) * t.scale];
}

function normalizeMapData(
  positions: PositionRecord[],
  regions: RegionRecord[],
): { positions: PositionRecord[]; regions: RegionRecord[] } {
  const t = {
    audio: computeStopTransform(positions, "audio"),
    balanced: computeStopTransform(positions, "balanced"),
    mood: computeStopTransform(positions, "mood"),
  } as const;

  const normPositions: PositionRecord[] = positions.map((p) => ({
    id: p.id,
    audio: applyTransform(p.audio, t.audio),
    balanced: applyTransform(p.balanced, t.balanced),
    mood: applyTransform(p.mood, t.mood),
  }));

  const normRegions: RegionRecord[] = regions.map((r) => ({
    ...r,
    stops: {
      audio: {
        centroid: applyTransform(r.stops.audio.centroid, t.audio),
        radius: r.stops.audio.radius * t.audio.scale,
      },
      balanced: {
        centroid: applyTransform(r.stops.balanced.centroid, t.balanced),
        radius: r.stops.balanced.radius * t.balanced.scale,
      },
      mood: {
        centroid: applyTransform(r.stops.mood.centroid, t.mood),
        radius: r.stops.mood.radius * t.mood.scale,
      },
    },
  }));

  return { positions: normPositions, regions: normRegions };
}

export async function fetchMapData(
  baseUrl: string = "/data",
  options: LoaderOptions = {},
): Promise<MapData> {
  options.onProgress?.("fetching");
  const [positionsRes, metadataRes, regionsRes] = await Promise.all([
    fetch(`${baseUrl}/positions.json`),
    fetch(`${baseUrl}/metadata.json`),
    fetch(`${baseUrl}/regions.json`),
  ]);
  if (!positionsRes.ok || !metadataRes.ok || !regionsRes.ok) {
    throw new Error("failed to fetch music map data");
  }
  const [rawPositions, rawMetadata, rawRegions] = await Promise.all([
    positionsRes.json() as Promise<PositionRecord[]>,
    metadataRes.json() as Promise<MetadataRecord[]>,
    regionsRes.json() as Promise<RegionRecord[]>,
  ]);
  options.onProgress?.("parsed");

  // Subsample BOTH positions and metadata to the same id set so the indices
  // (and atlasIndex references) stay aligned. regions.json is per-cluster
  // centroids — independent of album count — and is passed through untouched.
  const keptIds = pickSampledIds(rawPositions, SAMPLE_LIMIT);
  const filteredPositions =
    keptIds.size === rawPositions.length
      ? rawPositions
      : rawPositions.filter((p) => keptIds.has(p.id));
  const filteredMetadata =
    keptIds.size === rawPositions.length
      ? rawMetadata
      : rawMetadata.filter((m) => keptIds.has(m.id));

  const { positions, regions } = normalizeMapData(filteredPositions, rawRegions);
  const metadata = filteredMetadata;

  const maxAtlasIndex = metadata.reduce(
    (acc, m) => Math.max(acc, m.atlasIndex),
    -1,
  );
  const atlasUrls: string[] = [];
  for (let i = 0; i <= maxAtlasIndex; i++) {
    atlasUrls.push(`${baseUrl}/atlas-${i}.webp`);
  }

  return { positions, metadata, regions, atlasUrls };
}
