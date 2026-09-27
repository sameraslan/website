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
    render(<Tooltip kind="focus" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Kid A");
    expect(status.textContent).toContain("Radiohead");
    expect(status.textContent).not.toMatch(/·\s*0(\D|$)/);
  });

  it("includes the year segment when year is 1973", () => {
    useMapStore.setState({ data: fixture as any, focusedId: "b", hoveredId: null });
    render(<Tooltip kind="focus" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("The Dark Side of the Moon");
    expect(status.textContent).toContain("1973");
  });

  it("the hover label shows the hovered album when nothing is focused", () => {
    useMapStore.setState({ data: fixture as any, focusedId: null, hoveredId: "b" });
    const { container } = render(<Tooltip kind="hover" />);
    expect(container.textContent).toContain("1973");
  });

  it("keeps the focused label while the hover label shows another album", () => {
    useMapStore.setState({ data: fixture as any, focusedId: "a", hoveredId: "b" });
    const focus = render(<Tooltip kind="focus" />);
    expect(focus.container.textContent).toContain("Kid A");
    const hover = render(<Tooltip kind="hover" />);
    expect(hover.container.textContent).toContain("The Dark Side of the Moon");
  });

  it("hides the hover label when it would repeat the focused album", () => {
    useMapStore.setState({ data: fixture as any, focusedId: "a", hoveredId: "a" });
    const { container } = render(<Tooltip kind="hover" />);
    expect(container.textContent).toBe("");
  });
});
