// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MapInfo } from "./MapInfo";
import { MAP_INFO_CONTROLS, MAP_INFO_PARAGRAPHS } from "./mapInfoCopy";

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

  it("lists the pointer controls by default and the touch controls on touch", () => {
    render(<MapInfo />);
    fireEvent.click(button());
    for (const line of MAP_INFO_CONTROLS.pointer)
      expect(screen.getByRole("region").textContent).toContain(line);
    cleanup();
    render(<MapInfo touch />);
    fireEvent.click(button());
    const region = screen.getByRole("region");
    for (const line of MAP_INFO_CONTROLS.touch) expect(region.textContent).toContain(line);
    expect(region.textContent).not.toContain(MAP_INFO_CONTROLS.pointer[0]);
  });

  it("opens on mouse hover and closes shortly after the mouse leaves", () => {
    vi.useFakeTimers();
    try {
      render(<MapInfo />);
      fireEvent.pointerEnter(button(), { pointerType: "mouse" });
      expect(screen.getByRole("region")).toBeTruthy();
      fireEvent.pointerLeave(button(), { pointerType: "mouse" });
      fireEvent.pointerEnter(screen.getByRole("region"), { pointerType: "mouse" });
      vi.advanceTimersByTime(500);
      expect(screen.getByRole("region")).toBeTruthy();
      fireEvent.pointerLeave(screen.getByRole("region"), { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(500));
      expect(screen.queryByRole("region")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays open after a click on a hover-opened popover", () => {
    vi.useFakeTimers();
    try {
      render(<MapInfo />);
      fireEvent.pointerEnter(button(), { pointerType: "mouse" });
      fireEvent.click(button());
      fireEvent.pointerLeave(button(), { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole("region")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores touch hover", () => {
    render(<MapInfo />);
    fireEvent.pointerEnter(button(), { pointerType: "touch" });
    expect(screen.queryByRole("region")).toBeNull();
  });
});
