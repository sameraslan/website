"use client";

import dynamic from "next/dynamic";

import { NARROW_MEDIA_QUERY } from "./state/breakpoints";
import { startPrefetch } from "./data/loader";

const MusicMap = dynamic(
  () => import("./MusicMap").then((m) => m.MusicMap),
  { ssr: false }
);

// Kick off the data fetch at module scope, before the three.js/R3F chunk
// (loaded by the dynamic import above) has even started downloading, so the
// two overlap instead of the fetch waiting behind the chunk (see
// docs/superpowers/notes/2026-09-26-music-map-perf-audit.md item 1a).
// Narrow screens do mount the map (Task 11) but fetch from MusicMap's own
// mount effect instead; this module-scope head start is skipped there so a
// phone only pays for the payload once the map actually renders (item 1g).
// On `/` the ReactDOM.preload links in app/page.tsx start it for every size.
// `matchMedia` itself is guarded: this module is imported under jsdom in
// tests, and jsdom does not implement matchMedia at all, so calling it
// unconditionally would throw at import time.
if (
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  !window.matchMedia(NARROW_MEDIA_QUERY).matches
) {
  startPrefetch("/data");
}

export default function MusicMapClient() {
  return <MusicMap />;
}
