"use client";

import { useEffect, useRef, useState } from "react";

import { Scene } from "./canvas/Scene";
import { startPrefetch } from "./data/loader";
import { LoadingState } from "./overlays/LoadingState";
import { MapInfo } from "./overlays/MapInfo";
import { MobileFallback } from "./overlays/MobileFallback";
import { MobileSheet } from "./overlays/MobileSheet";
import { SearchOverlay } from "./overlays/SearchOverlay";
import { Slider } from "./overlays/Slider";
import { Tooltip } from "./overlays/Tooltip";
import { NARROW_MEDIA_QUERY } from "./state/breakpoints";
import { useMapStore } from "./state/store";

function isNarrowScreen(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(NARROW_MEDIA_QUERY).matches;
}

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
 * Music map, a 2D embedding of ~700 albums where proximity encodes similarity.
 * Renders a full WebGL canvas with overlays for search, tooltip, and a
 * sonic-to-mood slider. Data is loaded from `/data/*.json` + atlas sheets at
 * mount; the component takes no props in v1. See README.md in this directory.
 *
 * Below the narrow breakpoint (`NARROW_MEDIA_QUERY`, <640px) the map still
 * mounts, in a touch variant (Task 11 / spec 4.7): search is omitted, the
 * desktop hover tooltip is replaced by `MobileSheet`, and `Scene`/`CameraRig`
 * get an `isTouch` flag that caps dpr, drops idle drift, and adds pinch. Only
 * a genuinely missing WebGL context still falls back to the static image.
 */
export function MusicMap() {
  const mode = useMapStore((s) => s.mode);
  const data = useMapStore((s) => s.data);
  const setData = useMapStore((s) => s.setData);
  const setMode = useMapStore((s) => s.setMode);
  const containerRef = useRef<HTMLDivElement>(null);
  // Initialised from matchMedia directly (not a useEffect that starts at
  // `false`), so phones never render one frame committed to the desktop
  // path before the touch check catches up (perf audit item 1g).
  const [isNarrow, setIsNarrow] = useState(isNarrowScreen);
  // Lazy initializer, checked once on mount, same as isNarrow above: this
  // component is only ever rendered client-side (MusicMapClient's dynamic
  // import uses ssr: false), so there is no hydration mismatch to worry
  // about, and it avoids a setState call inside an effect body.
  const [webglOk] = useState(isWebGLAvailable);
  const isTouch = isNarrow;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(NARROW_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Narrow screens now mount the real map too (Task 11 item 1), so this
    // fetches on mount there as well; only the module-scope prefetch in
    // MusicMapClient.tsx still skips narrow (it can't know the map will
    // actually be used before the breakpoint check runs on the client).
    // A client navigation between `/` and `/music` shares the singleton
    // store; if it already has data (from the previous mount, or from the
    // module-scope prefetch already having resolved), skip fetching again.
    if (data) return;
    let cancelled = false;
    startPrefetch("/data")
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
  }, [data, setData, setMode]);

  if (!webglOk) return <MobileFallback />;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#faf6ec",
        overflow: "hidden",
      }}
    >
      {/* Skip-link. Off-screen by default via clip-path (instead of left:-9999,
          which the site's global `transition: all 0.2s` would animate over,
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
          background: #faf6ec;
          border: 1px solid #231d14;
          border-radius: 4px;
          color: #231d14;
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
      {data && <Scene isTouch={isTouch} />}
      {/* Edge feather, a paper-colored gradient that is transparent through
          the center and fades to solid #faf6ec at all four edges, so the
          canvas dissolves into the page instead of ending at a hard border.
          Sits above the canvas but below the chrome/tooltip (DOM order), and
          ignores pointer input. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            linear-gradient(to right, #faf6ec 0, rgba(250,246,236,0) 110px, rgba(250,246,236,0) calc(100% - 110px), #faf6ec 100%),
            linear-gradient(to bottom, #faf6ec 0, rgba(250,246,236,0) 110px, rgba(250,246,236,0) calc(100% - 110px), #faf6ec 100%)
          `,
        }}
      />
      {/* Desktop hover tooltip vs. the touch bottom sheet (spec 4.7): touch
          has no hover state to follow, so it gets a fixed card instead of a
          tooltip that would try to chase a finger. */}
      {isTouch ? (
        <MobileSheet />
      ) : (
        <>
          <Tooltip kind="focus" />
          <Tooltip kind="hover" />
        </>
      )}
      {/* Bottom-right control row: always visible, not hover-revealed. On
          touch it sits above the MobileSheet (bottom: 76px vs. the sheet's
          12px + ~54px tall) so the two never overlap, and search is omitted
          entirely (spec 4.7: "search is omitted on mobile"). The info button
          sits last so its popover can right-align with the row's edge. */}
      <div
        style={{
          position: "absolute",
          right: isTouch ? 16 : 48,
          bottom: isTouch ? 76 : 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Slider />
        {!isTouch && <SearchOverlay />}
        <MapInfo />
      </div>
      {/* Skip-link target, last in the map's DOM so the next Tab after
          following the link lands on whatever comes after the map (the
          caption on `/`, the essay on `/music`). tabIndex -1 lets the
          fragment navigation actually move focus here. Pinned to the
          bottom edge so the jump scrolls to the end of the map, not its top. */}
      <span
        id="after-music-map"
        tabIndex={-1}
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          outline: "none",
        }}
      />
    </div>
  );
}
