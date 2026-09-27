"use client";

import { useEffect, useMemo, useRef } from "react";

import type { MetadataRecord } from "../data/types";
import { setTooltipEl, tooltipTargetId, type TooltipKind } from "../state/tooltipEl";
import { useMapStore } from "../state/store";

/**
 * One label, pinned to the focused album (`kind="focus"`) or following the
 * hovered album (`kind="hover"`, hidden while that is the focused album
 * itself); MusicMap renders one of each. Renders once. Content (title/artist/year) is plain React state that only
 * changes on hover-enter/leave or focus change, never per frame. Position
 * and visibility are written imperatively by the canvas-side TooltipDriver
 * (see canvas/TooltipDriver.tsx) directly onto the root element via a ref
 * registered in state/tooltipEl.ts, so a fly-to or drift frame can move the
 * tooltip without going through React at all.
 *
 * `opacity`/`transform` are deliberately left out of the React-managed style
 * object below (only set once via the ref effect) so that a re-render here
 * (on hover/focus change) never clobbers what TooltipDriver just wrote.
 */
export function Tooltip({ kind }: { kind: TooltipKind }) {
  const data = useMapStore((s) => s.data);
  const focusedId = useMapStore((s) => s.focusedId);
  const hoveredId = useMapStore((s) => s.hoveredId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTooltipEl(kind, ref.current);
    if (ref.current) {
      ref.current.style.opacity = "0";
    }
    return () => setTooltipEl(kind, null);
  }, [kind]);

  const metaById = useMemo(() => {
    const m = new Map<string, MetadataRecord>();
    if (data) for (const rec of data.metadata) m.set(rec.id, rec);
    return m;
  }, [data]);

  const targetId = tooltipTargetId(kind, focusedId, hoveredId);
  const meta = targetId ? metaById.get(targetId) : undefined;

  return (
    <div
      ref={ref}
      // The focused album's label is announced; the hover label is a
      // pointer-only preview and stays out of the accessibility tree.
      role={kind === "focus" ? "status" : undefined}
      aria-live={kind === "focus" ? "polite" : undefined}
      aria-hidden={kind === "hover" ? true : undefined}
      data-tooltip={kind}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        padding: "6px 10px",
        background: "rgba(250, 246, 236, 0.95)",
        border: "1px solid #e1dac9",
        borderRadius: 4,
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 12,
        color: "#231d14",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        // The hover label draws over the pinned one where they meet.
        zIndex: kind === "hover" ? 2 : 1,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        willChange: "transform, opacity",
      }}
    >
      {meta && (
        <>
          <b>{meta.title}</b> · {meta.artist}
          {meta.year > 0 ? ` · ${meta.year}` : null}
        </>
      )}
    </div>
  );
}
