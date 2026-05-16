"use client";

import { useEffect, useRef, useState } from "react";

import { Scene } from "./canvas/Scene";
import { fetchMapData } from "./data/loader";
import { LoadingState } from "./overlays/LoadingState";
import { MobileFallback } from "./overlays/MobileFallback";
import { SearchOverlay } from "./overlays/SearchOverlay";
import { Slider } from "./overlays/Slider";
import { Tooltip } from "./overlays/Tooltip";
import { useMapStore } from "./state/store";

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Music map — a 2D embedding of ~5k albums where proximity encodes similarity.
 * Renders a full WebGL canvas with overlays for search, tooltip, and a
 * sonic-to-mood slider. Data is loaded from `/data/*.json` + atlas sheets at
 * mount; the component takes no props in v1. See README.md in this directory.
 */
export function MusicMap() {
  const mode = useMapStore((s) => s.mode);
  const data = useMapStore((s) => s.data);
  const setData = useMapStore((s) => s.setData);
  const setMode = useMapStore((s) => s.setMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => setWebglOk(isWebGLAvailable()), []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isNarrow) return;
    let cancelled = false;
    fetchMapData("/data")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error("music-map load failed", err);
        if (!cancelled) setMode("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [isNarrow, setData, setMode]);

  if (isNarrow) return <MobileFallback />;
  if (!webglOk) return <MobileFallback />;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#f6f0e1",
        overflow: "hidden",
      }}
    >
      {/* Skip-link. Off-screen by default via clip-path (instead of left:-9999,
          which the site's global `transition: all 0.2s` would animate over —
          and during the transition the link sits offscreen well past the test
          window). `:focus`/`:focus-visible` reveal it via clip-path:none. We
          also pin position with !important so the global transition can't
          touch geometry. */}
      <style>{`
        .music-map-skip-link {
          position: fixed !important;
          left: 16px !important;
          top: 16px !important;
          z-index: 50;
          padding: 8px 12px;
          background: #f6f0e1;
          border: 1px solid #2d2a22;
          border-radius: 4px;
          color: #2d2a22;
          font-family: ui-monospace, Menlo, monospace;
          font-size: 12px;
          text-decoration: none;
          /* Hide visually + from pointer events while still focusable. */
          clip-path: inset(50%);
          width: 1px;
          height: 1px;
          overflow: hidden;
          white-space: nowrap;
          transition: none !important;
        }
        .music-map-skip-link:focus,
        .music-map-skip-link:focus-visible {
          clip-path: none;
          width: auto;
          height: auto;
          overflow: visible;
          white-space: normal;
        }
      `}</style>
      <a href="#after-music-map" className="music-map-skip-link">
        Skip the music map
      </a>
      {mode === "loading" && <LoadingState />}
      {data && <Scene />}
      <Tooltip containerRef={containerRef} />
      <Slider />
      <SearchOverlay />
    </div>
  );
}
