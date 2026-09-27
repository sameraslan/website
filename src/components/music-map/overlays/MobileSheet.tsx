"use client";

import { useMemo } from "react";

import type { MetadataRecord } from "../data/types";
import { useMapStore } from "../state/store";

/**
 * Bottom sheet card for touch (spec 4.7 / "Home · phone" artboard). Rendered
 * inside the map container in place of the desktop hover Tooltip: unlike the
 * tooltip, it never chases the album on screen (there is no useful "resting"
 * position for a finger to hover), so it just shows the focused album's
 * title/artist/year, or a "tap a point" hint when nothing is focused. Plain
 * React state driven straight off the store; no canvas-side driver is
 * needed because it doesn't follow the album's projected screen position.
 */
export function MobileSheet() {
  const data = useMapStore((s) => s.data);
  const focusedId = useMapStore((s) => s.focusedId);

  const metaById = useMemo(() => {
    const m = new Map<string, MetadataRecord>();
    if (data) for (const rec of data.metadata) m.set(rec.id, rec);
    return m;
  }, [data]);

  const meta = focusedId ? metaById.get(focusedId) : undefined;

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        background: "color-mix(in srgb, var(--color-paper-soft) 94%, transparent)",
        border: "1px solid var(--color-rule)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        zIndex: 10,
      }}
    >
      {meta ? (
        <>
          <span className="font-display font-medium text-[18px]">{meta.title}</span>
          <span className="font-serif text-[13px] text-ink-muted">
            {meta.artist}
            {meta.year > 0 ? ` · ${meta.year}` : ""}
          </span>
          {meta.spotifyUrl && (
            <a
              href={meta.spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-tiny uppercase text-ink-muted"
            >
              open in spotify →
            </a>
          )}
        </>
      ) : (
        <span className="font-mono text-tiny uppercase text-ink-muted">tap a point</span>
      )}
    </div>
  );
}
