"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MAP_INFO_PARAGRAPHS, MAP_INFO_TITLE } from "./mapInfoCopy";

const PANEL_WIDTH = 300;
const GAP = 8;
const EDGE = 16;

type Placement = { left: number; top: number; maxHeight: number };

/**
 * Small "i" button in the map's control row that toggles a short popover
 * explaining the map. Styled like the slider and search pills (same height,
 * border, paper fill, mono label).
 *
 * The popover is portalled to <body> with fixed positioning, because the map
 * container clips its overflow and can be very short (the /music page on a
 * phone is ~160px tall). It opens above the button when there is room and
 * below it otherwise, and follows the button on scroll and resize. It only
 * mounts while open, so a closed control never sits over the canvas. Escape
 * (handled before the map's own Escape-releases-focus listener) and a
 * pointer press outside the button and panel both close it.
 */
export function MapInfo() {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const place = useCallback(() => {
    const btn = buttonRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, vw - EDGE * 2);
    const left = Math.max(EDGE, Math.min(r.right - width, vw - EDGE - width));
    // scrollHeight ignores maxHeight (full content) but not the 1px border.
    const h = panel.scrollHeight + 2;
    // Opening upward should not cover the site header (on /music at phone
    // width the map sits right under it); prefer opening downward instead.
    const header = document.querySelector("header");
    const topLimit = Math.max(EDGE, header ? header.getBoundingClientRect().bottom + GAP : 0);
    const above = r.top - GAP - topLimit;
    const below = vh - r.bottom - GAP - EDGE;
    let top: number;
    let maxHeight: number;
    if (h <= above || above >= below) {
      maxHeight = Math.max(above, 0);
      top = r.top - GAP - Math.min(h, maxHeight);
    } else {
      maxHeight = Math.max(below, 0);
      top = r.bottom + GAP;
    }
    setPlacement((p) =>
      p && p.left === left && p.top === top && p.maxHeight === maxHeight
        ? p
        : { left, top, maxHeight },
    );
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPlacement(null);
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Capture phase on window runs before FocusController's document
      // listener; stopping here means Escape closes only the popover and
      // leaves a focused album focused.
      e.stopPropagation();
      close();
      buttonRef.current?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="About this map"
        style={{
          width: 36,
          height: 36,
          flex: "none",
          background: open
            ? "var(--color-paper-soft)"
            : "color-mix(in srgb, var(--color-paper-soft) 92%, transparent)",
          border: "1px solid var(--color-rule)",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: open ? "var(--color-ink)" : "var(--color-ink-muted)",
          cursor: "pointer",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden
        >
          <circle cx="7" cy="7" r="6" />
          <line x1="7" y1="6" x2="7" y2="10.2" />
          <circle cx="7" cy="3.9" r="0.35" fill="currentColor" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="region"
            aria-label={MAP_INFO_TITLE}
            style={{
              position: "fixed",
              left: placement?.left ?? 0,
              top: placement?.top ?? 0,
              maxHeight: placement?.maxHeight,
              overflowY: "auto",
              // Hidden for the one layout pass before it has been measured.
              visibility: placement ? "visible" : "hidden",
              width: PANEL_WIDTH,
              maxWidth: `calc(100vw - ${EDGE * 2}px)`,
              boxSizing: "border-box",
              background: "color-mix(in srgb, var(--color-paper-soft) 96%, transparent)",
              border: "1px solid var(--color-rule)",
              padding: "12px 14px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              zIndex: 40,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, Menlo, monospace)",
                fontSize: "var(--text-tiny)",
                letterSpacing: "var(--text-tiny--letter-spacing)",
                textTransform: "uppercase",
                color: "var(--color-ink-muted)",
              }}
            >
              {MAP_INFO_TITLE}
            </span>
            {MAP_INFO_PARAGRAPHS.map((p) => (
              <p
                key={p}
                style={{
                  margin: 0,
                  fontFamily: "var(--font-serif)",
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: "var(--color-ink)",
                }}
              >
                {p}
              </p>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
