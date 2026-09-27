// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Tooltip } from "./Tooltip";
import { useMapStore } from "../state/store";

const fixture = {
  positions: [],
  metadata: [
    {
      id: "a",
      title: "Kid A",
      artist: "Radiohead",
      year: 0,
      spotifyUrl: "",
      clusterId: 0,
      atlasIndex: 0,
      atlasUV: [0, 0, 0.1, 0.1],
    },
    {
      id: "b",
      title: "The Dark Side of the Moon",
      artist: "Pink Floyd",
      year: 1973,
      spotifyUrl: "",
      clusterId: 0,
      atlasIndex: 0,
      atlasUV: [0, 0, 0.1, 0.1],
    },
  ],
  regions: [],
  atlasUrls: [],
};

describe("Tooltip", () => {
  it("omits the year segment when year is 0", () => {
    useMapStore.setState({ data: fixture as any, focusedId: "a", hoveredId: null });
    render(<Tooltip />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Kid A");
    expect(status.textContent).toContain("Radiohead");
    expect(status.textContent).not.toMatch(/·\s*0(\D|$)/);
  });

  it("includes the year segment when year is 1973", () => {
    useMapStore.setState({ data: fixture as any, focusedId: "b", hoveredId: null });
    render(<Tooltip />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("The Dark Side of the Moon");
    expect(status.textContent).toContain("1973");
  });

  it("falls back to hoveredId when nothing is focused", () => {
    useMapStore.setState({ data: fixture as any, focusedId: null, hoveredId: "b" });
    render(<Tooltip />);
    expect(screen.getByRole("status").textContent).toContain("1973");
  });

  it("focus wins over hover when both are set", () => {
    useMapStore.setState({ data: fixture as any, focusedId: "a", hoveredId: "b" });
    render(<Tooltip />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Kid A");
    expect(status.textContent).not.toContain("1973");
  });
});
