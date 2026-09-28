// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { HeroCaption } from "./HeroCaption";

describe("HeroCaption", () => {
  it("renders the exact headline, body, and hint copy", () => {
    render(<HeroCaption />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(
      "Hey, I'm Samer. I build AI for lawyers at Bloomberg and do research in neuroscience and AI."
    );
    expect(heading.className).toContain("font-display");

    expect(
      screen.getByText("Enjoy playing around with this music map of my album listening.")
    ).toBeTruthy();

    expect(screen.getByText("hover to read · click for neighbours")).toBeTruthy();
    expect(screen.getByText("scroll to zoom · drag to pan")).toBeTruthy();

    expect(screen.getByText("tap a point · pinch to zoom")).toBeTruthy();
  });
});
