// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SearchOverlay } from "./SearchOverlay";
import { useMapStore } from "../state/store";

const fixture = {
  positions: [],
  metadata: [
    { id: "a", title: "For Emma, Forever Ago", artist: "Bon Iver", year: 2008, spotifyUrl: "", clusterId: 0, atlasIndex: 0, atlasUV: [0, 0, 0.1, 0.1] },
    { id: "b", title: "Carrie & Lowell", artist: "Sufjan Stevens", year: 2015, spotifyUrl: "", clusterId: 0, atlasIndex: 0, atlasUV: [0, 0, 0.1, 0.1] },
  ],
  regions: [],
  atlasUrls: [],
};

describe("SearchOverlay", () => {
  it("shows fuzzy-matched suggestions and focuses on selection", () => {
    useMapStore.setState({ data: fixture as any, focusedId: null });
    render(<SearchOverlay />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "bon iver" } });
    expect(screen.getByText(/For Emma, Forever Ago/)).toBeTruthy();

    fireEvent.mouseDown(screen.getByText(/For Emma, Forever Ago/));
    expect(useMapStore.getState().focusedId).toBe("a");
  });
});
