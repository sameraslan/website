import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMapData, startPrefetch } from "./loader";

function mockFetchWithCount(n: number) {
  const positions = Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    audio: [0, 0],
    balanced: [0, 0],
    mood: [0, 0],
  }));
  const metadata = Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    title: "x",
    artist: "y",
    year: 2008,
    spotifyUrl: "",
    clusterId: 0,
    atlasIndex: 0,
    atlasUV: [0, 0, 0.1, 0.1],
  }));
  const regions = [{
    clusterId: 0, label: "rock", color: "#8a3a2a",
    stops: {
      audio: { centroid: [0, 0], radius: 0.5 },
      balanced: { centroid: [0, 0], radius: 0.5 },
      mood: { centroid: [0, 0], radius: 0.5 },
    },
  }];
  return vi.fn(async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/positions.json")) return new Response(JSON.stringify(positions));
    if (url.endsWith("/metadata.json")) return new Response(JSON.stringify(metadata));
    if (url.endsWith("/regions.json")) return new Response(JSON.stringify(regions));
    throw new Error(`unexpected url: ${url}`);
  });
}

describe("fetchMapData", () => {
  it("fetches positions, metadata, regions in parallel and discovers atlas urls", async () => {
    const fetchMock = mockFetchWithCount(1);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMapData("/data");

    expect(result.positions).toHaveLength(1);
    expect(result.metadata).toHaveLength(1);
    expect(result.regions).toHaveLength(1);
    expect(result.atlasUrls).toEqual(["/data/atlas-0.webp"]);
  });

  it("does not sample the dataset: every fetched record is kept", async () => {
    const fetchMock = mockFetchWithCount(4081);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMapData("/data");

    expect(result.positions).toHaveLength(4081);
    expect(result.metadata).toHaveLength(4081);
  });
});

describe("startPrefetch", () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).__musicMapPrefetch;
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__musicMapPrefetch;
  });

  it("returns the same in-flight promise for the same base on repeated calls", async () => {
    const fetchMock = mockFetchWithCount(1);
    vi.stubGlobal("fetch", fetchMock);

    const p1 = startPrefetch("/data");
    const p2 = startPrefetch("/data");

    expect(p1).toBe(p2);
    await p1;
    // Each JSON file is fetched exactly once, not once per startPrefetch call.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
