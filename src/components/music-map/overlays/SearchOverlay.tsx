"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";

import { useMapStore } from "../state/store";

const MAX_RESULTS = 5;

/**
 * Search pill: a always-visible bottom-right button that opens a popover
 * with the fuzzy-search input and results. The button itself never hides;
 * only the popover toggles.
 */
export function SearchOverlay() {
  const data = useMapStore((s) => s.data);
  const focus = useMapStore((s) => s.focus);
  const [q, setQ] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => {
    if (!data) return null;
    return new Fuse(data.metadata, {
      keys: ["title", "artist"],
      threshold: 0.35,
      includeScore: true,
    });
  }, [data]);

  const results = useMemo(() => {
    if (!fuse || q.length < 2) return [];
    return fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item);
  }, [fuse, q]);

  useEffect(() => {
    if (panelOpen) inputRef.current?.focus();
  }, [panelOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        setPanelOpen(true);
      }
      if (e.key === "Escape") {
        setListOpen(false);
        setPanelOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        aria-expanded={panelOpen}
        aria-label="Search the music map"
        style={{
          height: 36,
          background: "color-mix(in srgb, var(--color-paper-soft) 92%, transparent)",
          border: "1px solid var(--color-rule)",
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-mono, ui-monospace, Menlo, monospace)",
          fontSize: "var(--text-tiny)",
          color: "var(--color-ink-muted)",
          letterSpacing: "var(--text-tiny--letter-spacing)",
          textTransform: "uppercase",
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
          <circle cx="6" cy="6" r="4.6" />
          <line x1="9.6" y1="9.6" x2="13" y2="13" />
        </svg>
        <span>search</span>
      </button>
      {panelOpen && (
        <div
          style={{
            position: "absolute",
            bottom: 44,
            right: 0,
            width: 280,
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 12,
            color: "#231d14",
          }}
        >
          <input
            ref={inputRef}
            placeholder="search albums  /"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            onBlur={() => setTimeout(() => setListOpen(false), 150)}
            aria-label="Search music map"
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "rgba(250, 246, 236, 0.92)",
              border: "1px solid #e1dac9",
              borderRadius: 4,
              fontFamily: "inherit",
              fontSize: "inherit",
              color: "inherit",
              outline: "none",
            }}
          />
          {listOpen && results.length > 0 && (
            <ul
              role="listbox"
              style={{
                listStyle: "none",
                margin: "4px 0 0",
                padding: 0,
                background: "#faf6ec",
                border: "1px solid #e1dac9",
                borderRadius: 4,
              }}
            >
              {results.map((m) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    focus(m.id);
                    setQ("");
                    setListOpen(false);
                  }}
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #e1dac9",
                  }}
                >
                  {/* year 0 means unknown in metadata.json: omit it and its separator. */}
                  <strong>{m.title}</strong> · {m.artist}
                  {m.year > 0 && ` · ${m.year}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
