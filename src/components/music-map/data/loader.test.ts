import { describe, expect, it, vi } from "vitest";

import { fetchMapData } from "./loader";

describe("fetchMapData", () => {
  it("fetches positions, metadata, regions in parallel and discovers atlas urls", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/positions.json")) {
        return new Response(JSON.stringify([{ id: "a", audio: [0, 0], balanced: [0, 0], mood: [0, 0] }]));
      }
      if (url.endsWith("/metadata.json")) {
        return new Response(JSON.stringify([{
          id: "a", title: "x", artist: "y", year: 2008, spotifyUrl: "",
          clusterId: 0, atlasIndex: 0, atlasUV: [0, 0, 0.1, 0.1],
        }]));
      }
      if (url.endsWith("/regions.json")) {
        return new Response(JSON.stringify([{
          clusterId: 0, label: "rock", color: "#8a3a2a",
          stops: {
            audio: { centroid: [0, 0], radius: 0.5 },
            balanced: { centroid: [0, 0], radius: 0.5 },
            mood: { centroid: [0, 0], radius: 0.5 },
          },
        }]));
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMapData("/data");

    expect(result.positions).toHaveLength(1);
    expect(result.metadata).toHaveLength(1);
    expect(result.regions).toHaveLength(1);
    expect(result.atlasUrls).toEqual(["/data/atlas-0.webp"]);
  });
});
