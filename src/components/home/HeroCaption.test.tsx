// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { HeroCaption } from "./HeroCaption";

describe("HeroCaption", () => {
  it("renders the exact headline, body, and hint copy", () => {
    render(<HeroCaption />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(
      "Machine learning engineer working at the intersection of AI and law."
    );
    expect(heading.className).toContain("font-display");

    expect(
      screen.getByText("Here's an evolving map of what I listen to.")
    ).toBeTruthy();

    expect(
      screen.getByText("hover to read · click for neighbours · scroll to zoom")
    ).toBeTruthy();

    expect(screen.getByText("tap a point · pinch to zoom")).toBeTruthy();
  });
});
