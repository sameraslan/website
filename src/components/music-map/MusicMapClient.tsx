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
// Narrow screens don't mount the map yet (Task 11), so skip the fetch there
// to avoid downloading the desktop payload on a phone (item 1g).
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
