# Website Improvement Pass: Design Spec

**Date:** 2026-09-26
**Owner:** Samer Aslan
**Status:** Approved in chat (choices recorded below), ready for implementation plan
**Builds on:** `2026-05-12-personal-website-design.md` and `2026-05-12-music-map-design.md`
**Mockups:** https://claude.ai/artifact/BcY62qEFRRW4T1RB413JUP (artboards "Home · B", "Home · phone", "Map · overview / hover / focus", "Type system")

## 1. Goal

Take sameraslan.com from "quiet but broken in ways the visitor feels" to "quiet and snappy". The zen aesthetic stays. The music map stays the hook. Every change below either restores what the original spec designed, fixes a bug the audit found, or gives the home page enough framing that a first-time visitor knows whose site it is and what the map is.

## 2. Decisions already made

| Question | Choice |
|---|---|
| Home layout | **Option B**: full-bleed map under the header, caption card bottom-left, controls bottom-right |
| Home copy | Card reads: heading "Machine learning engineer working at the intersection of AI and law." then "Here's an evolving map of what I listen to." then a mono hint line. Nothing else. Copy on every other page is unchanged in this pass. |
| Overview rendering | **Tinted discs + region labels** at overview zoom; cover art fades in as you zoom, at full opacity |
| Idle motion | **Gentle drift only**. No auto-tour. Never dims the map. Never steals focus. |
| Scope | Everything in §4 except items marked *deferred*. About-page rewrite is out (copy frozen). Pipeline revamp (RYM album list, RYM links on click, real years, re-atlas) is deferred until Samer supplies the RYM list. |

## 3. Non-goals

- No copy changes outside the home caption card.
- No dark mode, no new pages, no new nav items.
- No pipeline run in this pass (the local Python env cannot import numpy; Spotify credentials are absent). The client must tolerate `year === 0` and `popularity === 0`.
- No re-atlasing. The four existing 3072² sheets stay; loading them becomes lazy and off-thread instead.

## 4. Changes

### 4.1 Restore the design system (Tailwind v4 tokens)

The site runs Tailwind v4 (`@import "tailwindcss"` in `src/app/globals.css`), and v4 does not read `tailwind.config.ts` unless `@config` is present. Today only colors are in `@theme`, so `font-display`, `font-serif`, `font-mono`, `text-tiny`, `text-h1`, `max-w-page`, `max-w-text`, `max-w-list`, `transitionDuration` all silently fail.

Move every token from `tailwind.config.ts` into `@theme` in `globals.css` and delete `tailwind.config.ts`:

```css
@theme {
  --font-display: var(--font-cormorant), 'EB Garamond', Georgia, serif;
  --font-serif:   var(--font-newsreader), 'EB Garamond', Georgia, serif;
  --font-mono:    var(--font-plex-mono), ui-monospace, SFMono-Regular, monospace;

  --text-tiny: 0.625rem;  --text-tiny--line-height: 1.4; --text-tiny--letter-spacing: 0.12em;
  --text-small: 0.875rem; --text-small--line-height: 1.5;
  --text-body: 1.03rem;   --text-body--line-height: 1.6;
  --text-h3: 1.5rem;      --text-h3--line-height: 1.3;
  --text-h2: 2.25rem;     --text-h2--line-height: 1.1;
  --text-h1: 2.75rem;     --text-h1--line-height: 1.05;
  --text-display: 4.75rem; --text-display--line-height: 0.92;

  --container-prose: 720px;
  --container-text: 60ch;
  --container-list: 880px;
  --container-page: 1180px;

  --default-transition-duration: 180ms;
}
```

Acceptance: on `/projects` at 1440px, `h1` computed font-family starts with `Cormorant Garamond`, nav links start with `Newsreader`, the mono meta line is 10px with 0.12em tracking, and `main > div` is 1180px wide. On a 375px viewport the `h1` is 44px.

### 4.2 Home page (Option B)

`src/app/page.tsx` renders a full-bleed hero: the map fills the viewport below the header (`height: calc(100vh - header)`, min 560px), edge to edge, with no page padding. The root layout's padded container must not wrap the home page; either the layout checks the route or the home page opts out via a layout group. Prefer a route group: move the padded `<div>` into `src/app/(pages)/layout.tsx` and keep `src/app/page.tsx` at the root with its own bare layout. All other routes move under `src/app/(pages)/`. URLs do not change.

The header on the home page sits over the map with a paper gradient behind it (as in the mockup) so the map runs under it.

Caption card (bottom-left, 380px wide, `paper-soft` at 92% with a `rule` border):

- `h1` in display face, 27px: "Machine learning engineer working at the intersection of AI and law."
- Body 15.5px ink: "Here's an evolving map of what I listen to."
- Mono tiny uppercase muted: "hover to read · click for neighbours · scroll to zoom"

Controls (bottom-right, always visible, not hover-revealed): the audio/mood slider as a 36px-tall bordered pill, and a search button opening the existing search overlay. Both use mono tiny uppercase. The hover-only reveal in `MusicMap.tsx` is removed.

`siteConfig.tagline` is deleted (it was never rendered and the card copy replaces it).

### 4.3 Map rendering: overview look

Shader (`shaders/album.ts`):

- Dot mode (sprite < 24 CSS px): color is the cluster color at full strength (`clusterColor(id)`), not `mix(ink, cluster, 0.3)`. Opacity 1.
- Cover mode: covers at full opacity. The current `v_dim` path only applies when an album is focused (unchanged), and dimmed sprites also shrink to 0.85 scale so they recede rather than smearing paper on paper.
- Cover fade: between 24 and 40 CSS px, mix from disc color to cover so the transition is a crossfade, not a pop.

Region labels: re-enable `RegionLabels.tsx` with corrected centroids computed on the client from the loaded positions (mean of each cluster's positions at the current `sliderT`), not from `regions.json` centroids. Labels are the `regions.json` labels, italic display face, 22px at overview, fading out as the camera zooms in. *Amended during implementation:* the fade is relative to the fitted overview zoom (`zoom / fitZoom`, fully visible at 1.6x fit and below, gone by 2.1x fit), not the absolute `zoomT`, because the fitted zoom varies with the dataset and viewport. Rendered as DOM overlays positioned via the projection bridge (same mechanism as the tooltip) so they use the site font.

Region washes stay off.

### 4.4 Map interaction (the "snappy" work)

All items reference the audit in `docs/superpowers/notes/2026-09-26-music-map-perf-audit.md`.

1. **Interaction split.** `store.ts` gains `lastCameraGrab: number` set only on pointerdown-drag, wheel, and pinch. *Amended during implementation:* slider drags are not camera grabs; they retarget a running glide in place (see 10) instead of cancelling it. `lastInteraction` keeps firing on hover for drift gating. `FlyToFocus` cancels only on `lastCameraGrab > startWall`.
2. **Durations.** `focusFlyDurationMs: 550` with `easeOutCubic`; `focusReleaseDurationMs: 320` with `easeOutCubic`. Remove the tour presets from `tuning.ts` (`near-focus`, `slow-tour`, `pan-loop`); keep one `default` preset.
3. **Hover.** `CursorTracker` runs `nearestAlbumIndex` on pointermove (throttled to one per animation frame) and writes `u_hoverIndex` to the material and `cursor: pointer` on the canvas when within 14 CSS px of a point. Hovered sprite scales 1.25 and gets a 2px paper ring plus a 1px ink ring (drawn in the fragment shader). The tooltip shows on hover after 80ms and on focus immediately.
4. **Zoom.** Wheel zoom targets a `targetZoom` that the frame loop approaches with an exponential time constant of 90ms, anchored to the world point under the cursor. Trackpad pinch (`ctrlKey`) uses half the sensitivity. Range stays 0.5 to 5. The wheel handler calls `preventDefault`, so a wheel over the full-bleed home hero zooms the map rather than scrolling the page; this is as designed (the page below the hero is reached by scrolling outside the map, the keyboard, or the skip link).
5. **Pan.** `setPointerCapture` on pointerdown; velocity averaged over the last three move events.
6. **No React state per frame.** `cursorWorld` and `zoomT` move out of `SceneInner` state into refs written by `CursorTracker`/`CameraRig` and read by `AlbumField` in `useFrame`. The atlas loader reads `camera.zoom` directly.
7. **Tooltip.** One `useFrame` in a canvas-side component writes `transform: translate3d(x,y,0)` to the tooltip element via a ref; the two `CustomEvent`s and per-frame `setState` go away. `meta` is memoized on `focusedId`/`hoverId`. If `year === 0`, omit the year segment.
8. **Idle.** `AutoTour` is unmounted and deleted. `AmbientDrift` starts after 10s idle (`driftIdleDelayMs: 10_000`), amplitude 0.08, never sets `focusedId`, and never enters focus mode. Cursor on canvas or any camera grab pauses drift; it resumes after the same delay.
9. **Escape / empty click** release focus. *Amended during implementation:* empty click was existing behaviour; Escape-to-release is new in this pass (a document-level `keydown` in `FocusController`, ignored while a text field such as the search input has focus). An empty click is one farther than the hover radius (14 CSS px for a mouse, 24 for touch and pen) from every album.
10. **Slider.** `FlyToFocus` no longer restarts on `sliderT`; it updates the running animation's target. `saveToSession` is debounced to 250ms.

### 4.5 Map load path

1. `SAMPLE_LIMIT` in `loader.ts` becomes `Infinity` (render all 4,081). Overdraw is bounded by clamping sprite size to `min(240, viewportHeight * 0.18 * dpr)` device px.
2. `page.tsx` preloads `/data/positions.json`, `/data/metadata.json`, `/data/regions.json` with `<link rel="preload" as="fetch" crossorigin>`; `MusicMapClient.tsx` kicks off `fetchMapData()` at module scope so the fetch overlaps the three.js chunk.
3. Atlases load through `ImageBitmapLoader` (off-thread decode) and only when `camera.zoom >= 1.6` (real zoom, not `zoomT`), atlas-0 first, then the rest one at a time in order of how many currently visible sprites reference each sheet.
4. `<Canvas antialias={false} dpr={[1, 2]}>`; `frameloop="demand"` with `invalidate()` called from the pointer handlers, drift, fly-to, and slider.
5. `next.config.mjs` adds `headers()` for `/data/:path*` with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` (files are not hashed yet; immutable comes with the pipeline revamp).
6. `isNarrow` initialises from `matchMedia` inside the `useState` initialiser so phones do not download the desktop payload before the touch map mounts.
7. Delete `RegionWashes.tsx`, `shaders/wash.ts`, `BackgroundLayer.tsx`, `AutoTour.tsx`, `TuneHud.tsx`, `QAExpose`, and the `window.__mapStore` / `window.__tune` globals. Drop the `@react-three/drei` import by passing camera props to `<Canvas>`.

### 4.6 `/music` page

The map is rendered a second time on `/music` inside a padded container. Bugs: canvas stuck at 300×150 and data re-fetched in a loop. Root cause to confirm during implementation (suspects: the `useEffect` in `MusicMap.tsx` depending on `setData`/`setMode` identities plus the shared singleton store already holding data; the `<Canvas>` not observing its container's size). Fix so that `/music` renders the same map at `aspect-[2/1]` with one fetch. If the store already has data, no refetch.

### 4.7 Mobile (`< 640px`)

Replace `MobileFallback` with a touch map: the same `<MusicMap>` at `height: 390px`, `dpr` capped at 1.5, drift off, region labels on, pinch-to-zoom and one-finger pan via pointer events (already pointer-based; add `touch-action: none` on the canvas and pinch handling from two active pointers), tap = focus, tap on empty = release. The tooltip becomes a bottom sheet card inside the map (as in the "Home · phone" artboard): title, artist, year, and the hint "tap a point" when nothing is focused. The caption card content renders below the map as normal flow, not overlaid. Search is omitted on mobile. WebGL-unavailable devices still get the static fallback.

### 4.8 Metadata

- `src/app/icon.svg`: a 32px moss circle on paper (matches the map's dot).
- `src/app/opengraph-image.tsx` (Next `ImageResponse`): paper background, name in display face, the tagline line, and a scatter of 60 cluster-coloured discs generated deterministically. 1200×630.
- `layout.tsx` metadata gains `metadataBase`, `openGraph`, and `twitter.card = "summary_large_image"`.

### 4.9 Deferred (needs the RYM list)

Album list from Samer's RYM export; click opens the album on RYM; real years; single atlas sheet; hashed data filenames with immutable caching; "listening lately" data.

## 5. Verification

- `npm test` stays green; new unit tests for: token presence in the built CSS, `nearestAlbumIndex` throttle helper, zoom-anchor math, centroid computation, `year === 0` tooltip formatting, pinch distance-to-zoom math.
- Playwright (already a devDependency) is the feedback loop for every UI task, per project convention: screenshot before, during, and after at 1440×900 and 375×812. Scripts live in `scripts/ui-check/` and are not part of `npm test`.
- Performance gate on the home page at 1440×900 in Chromium: click-to-settle under 700ms, no React commit on pointermove (React Profiler), first map paint (dots visible) under 1.5s on a throttled "Fast 3G" profile with cache disabled, GPU texture memory under 60MB before the first zoom.
