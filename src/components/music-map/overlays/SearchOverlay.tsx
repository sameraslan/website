"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";

import { useMapStore } from "../state/store";

const MAX_RESULTS = 5;

export function SearchOverlay() {
  const data = useMapStore((s) => s.data);
  const focus = useMapStore((s) => s.focus);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
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
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
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
      {open && results.length > 0 && (
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
              tabIndex={0}
              onMouseDown={(e) => {
                e.preventDefault();
                focus(m.id);
                setQ("");
                setOpen(false);
              }}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #e1dac9",
              }}
            >
              <strong>{m.title}</strong> · {m.artist} · {m.year}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
