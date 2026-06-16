"use client";

import { useEffect, useRef, useState } from "react";

import { interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";

export function Tooltip({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const data = useMapStore((s) => s.data);
  const focusedId = useMapStore((s) => s.focusedId);
  const sliderT = useMapStore((s) => s.sliderT);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!data || !focusedId) {
      setPos(null);
      return;
    }
    const album = data.positions.find((p) => p.id === focusedId);
    if (!album) return;
    function update() {
      const canvas = containerRef.current?.querySelector("canvas");
      if (!canvas) return;
      const event = new CustomEvent("music-map:request-project", {
        detail: { worldXY: interpolatePosition(album!.audio, album!.balanced, album!.mood, sliderT) },
      });
      canvas.dispatchEvent(event);
      rafRef.current = requestAnimationFrame(update);
    }
    rafRef.current = requestAnimationFrame(update);

    function onResolved(e: Event) {
      const detail = (e as CustomEvent).detail as { screenX: number; screenY: number };
      setPos({ x: detail.screenX, y: detail.screenY });
    }
    const canvas = containerRef.current?.querySelector("canvas");
    canvas?.addEventListener("music-map:project-result", onResolved as EventListener);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas?.removeEventListener("music-map:project-result", onResolved as EventListener);
    };
  }, [data, focusedId, sliderT, containerRef]);

  if (!focusedId || !pos || !data) return null;
  const meta = data.metadata.find((m) => m.id === focusedId);
  if (!meta) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y - 60,
        transform: "translate(-50%, 0)",
        padding: "6px 10px",
        background: "rgba(250, 246, 236, 0.95)",
        border: "1px solid #e1dac9",
        borderRadius: 4,
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 12,
        color: "#231d14",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <b>{meta.title}</b> · {meta.artist} · {meta.year}
    </div>
  );
}
