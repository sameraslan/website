import type { MapData, MetadataRecord, PositionRecord, RegionRecord, SliderStopId } from "./types";

export interface LoaderOptions {
  onProgress?: (phase: "fetching" | "parsed" | "atlas-0-ready") => void;
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
  // Center on the median (robust to skewed long tails, many stops have
  // outliers reaching x=-1.68 or y=-1.23 while the bulk sits near zero).
  const cx = percentile(xs, 0.5);
  const cy = percentile(ys, 0.5);
  // Scale from the p5..p95 spread around the median, this is the bulk we
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
  // credentials: "same-origin" matches the crossOrigin="anonymous" preload
  // links in src/app/page.tsx, so the browser reuses the preloaded response
  // instead of firing a second, duplicate request.
  const fetchOpts: RequestInit = { credentials: "same-origin" };
  const [positionsRes, metadataRes, regionsRes] = await Promise.all([
    fetch(`${baseUrl}/positions.json`, fetchOpts),
    fetch(`${baseUrl}/metadata.json`, fetchOpts),
    fetch(`${baseUrl}/regions.json`, fetchOpts),
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

  // Render every album; no subsampling. Overdraw is bounded elsewhere by
  // clamping sprite size to the viewport (u_maxSpritePx, see AlbumField.tsx).
  const { positions, regions } = normalizeMapData(rawPositions, rawRegions);
  const metadata = rawMetadata;

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

// One in-flight (or settled) fetch per base url, memoised on globalThis so it
// survives module re-evaluation across the module-scope call in
// MusicMapClient.tsx and the client-navigation call in MusicMap.tsx. A plain
// module-level Map would not be shared if the module is instantiated more
// than once (e.g. by different bundler chunks), so globalThis is the one
// reliably shared place.
interface PrefetchGlobal {
  __musicMapPrefetch?: Map<string, Promise<MapData>>;
}

function prefetchRegistry(): Map<string, Promise<MapData>> {
  const g = globalThis as PrefetchGlobal;
  if (!g.__musicMapPrefetch) {
    g.__musicMapPrefetch = new Map();
  }
  return g.__musicMapPrefetch;
}

/**
 * Kicks off fetchMapData(base) at most once per base url and memoises the
 * resulting promise so repeated calls (module-scope prefetch in
 * MusicMapClient.tsx, then MusicMap.tsx awaiting the same load) share one
 * network request set instead of fetching the JSON files twice.
 */
export function startPrefetch(base: string): Promise<MapData> {
  const registry = prefetchRegistry();
  const existing = registry.get(base);
  if (existing) return existing;
  const promise = fetchMapData(base);
  registry.set(base, promise);
  // A transient network failure should not poison every later mount in the
  // session: if this fetch rejects, drop it from the registry so the next
  // startPrefetch(base) call (e.g. a retry, or a later client navigation)
  // starts a fresh fetch instead of reusing the same rejected promise
  // forever. The caller still sees the original rejection via `promise`
  // itself; this only affects what future callers get.
  promise.catch(() => {
    if (registry.get(base) === promise) {
      registry.delete(base);
    }
  });
  return promise;
}
