// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MapInfo } from "./MapInfo";
import { MAP_INFO_PARAGRAPHS } from "./mapInfoCopy";

afterEach(cleanup);

function button() {
  return screen.getByRole("button", { name: /about this map/i });
}

describe("MapInfo", () => {
  it("is closed by default and renders no popover", () => {
    render(<MapInfo />);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("toggles the popover and its copy with the button", () => {
    render(<MapInfo />);
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    const region = screen.getByRole("region");
    expect(button().getAttribute("aria-controls")).toBe(region.id);
    for (const p of MAP_INFO_PARAGRAPHS) expect(region.textContent).toContain(p);
    fireEvent.click(button());
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("closes on Escape without letting the key reach document listeners", () => {
    let documentSawEscape = false;
    const onDoc = (e: KeyboardEvent) => {
      if (e.key === "Escape") documentSawEscape = true;
    };
    document.addEventListener("keydown", onDoc);
    render(<MapInfo />);
    fireEvent.click(button());
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("region")).toBeNull();
    expect(documentSawEscape).toBe(false);
    expect(document.activeElement).toBe(button());
    document.removeEventListener("keydown", onDoc);
  });

  it("closes on a pointer press outside but not inside", () => {
    render(<MapInfo />);
    fireEvent.click(button());
    fireEvent.pointerDown(screen.getByRole("region"));
    expect(screen.getByRole("region")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
