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

    // The search trigger is a pill button; the input only mounts once the
    // popover is opened.
    fireEvent.click(screen.getByRole("button", { name: /search the music map/i }));

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "bon iver" } });
    expect(screen.getByText(/For Emma, Forever Ago/)).toBeTruthy();

    fireEvent.mouseDown(screen.getByText(/For Emma, Forever Ago/));
    expect(useMapStore.getState().focusedId).toBe("a");
  });

  it("shows the year when known and omits it (and its separator) when year is 0", () => {
    const withUnknownYear = {
      ...fixture,
      metadata: [
        ...fixture.metadata,
        { id: "c", title: "Untitled Tape", artist: "Nobody Known", year: 0, spotifyUrl: "", clusterId: 0, atlasIndex: 0, atlasUV: [0, 0, 0.1, 0.1] },
      ],
    };
    useMapStore.setState({ data: withUnknownYear as any, focusedId: null });
    const { unmount } = render(<SearchOverlay />);
    fireEvent.click(screen.getByRole("button", { name: /search the music map/i }));
    const input = screen.getByPlaceholderText(/search/i);

    fireEvent.change(input, { target: { value: "untitled tape" } });
    const unknown = screen.getByText(/Untitled Tape/).closest("li")!;
    expect(unknown.textContent).toBe("Untitled Tape · Nobody Known");

    fireEvent.change(input, { target: { value: "bon iver" } });
    const known = screen.getByText(/For Emma, Forever Ago/).closest("li")!;
    expect(known.textContent).toBe("For Emma, Forever Ago · Bon Iver · 2008");
    unmount();
  });
});
