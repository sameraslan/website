// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { HeroCaption } from "./HeroCaption";

describe("HeroCaption", () => {
  it("renders the exact headline and body copy, linking to projects and research", () => {
    render(<HeroCaption />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(
      "Hey, I'm Samer. I build AI for lawyers at Bloomberg and do research in neuroscience and AI."
    );
    expect(heading.className).toContain("font-display");

    const body = heading.nextElementSibling!;
    expect(body.textContent).toBe(
      "Enjoy playing around with this map of my album listening, and feel free to look around my projects and research too."
    );
    expect(screen.getByRole("link", { name: "projects" }).getAttribute("href")).toBe("/projects");
    expect(screen.getByRole("link", { name: "research" }).getAttribute("href")).toBe("/research");

    // Map controls moved into the map's info popover.
    expect(screen.queryByText("hover to read · click for neighbours")).toBeNull();
    expect(screen.queryByText("tap a point · pinch to zoom")).toBeNull();
  });
});
