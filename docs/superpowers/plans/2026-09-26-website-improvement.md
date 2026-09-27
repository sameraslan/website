# Website Improvement Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the designed type system, give the home page a full-bleed map with a caption card, make the map snappy and legible, fix `/music` and mobile, and add favicon/OG metadata.

**Architecture:** Next 16 App Router with a route group `(pages)` for padded routes and a bare root `page.tsx` for the hero. The music map stays an R3F `InstancedMesh` with custom shaders; interaction state moves from React state into refs and Zustand, camera motion becomes target-driven with short exponential smoothing, and the canvas renders on demand.

**Tech Stack:** Next 16, React 19, Tailwind v4 (`@theme` tokens), three 0.169, @react-three/fiber 9, Zustand, Vitest + Testing Library (unit), Playwright (UI feedback loop, `scripts/ui-check/`).

**Spec:** `docs/superpowers/specs/2026-09-26-website-improvement-design.md`
**Audit:** `docs/superpowers/notes/2026-09-26-music-map-perf-audit.md`

## Global Constraints

- Node 20: run every command with `export PATH=$HOME/.nvm/versions/node/v20.20.2/bin:$PATH` first (system Node is 18 and fails).
- Work only inside this worktree. Commit after every task with the attribution line the session reminder gives.
- Copy on every page except the home caption card is frozen. Do not edit `.mdx` or `AboutHeader.tsx` text.
- Home caption card copy, verbatim: heading "Machine learning engineer working at the intersection of AI and law." / body "Here's an evolving map of what I listen to." / hint "hover to read · click for neighbours · scroll to zoom".
- Colors: paper `#faf6ec`, paper-soft `#fdfaf2`, ink `#231d14`, ink-muted `#6b5e47`, ink-dim `#a99c80`, moss `#5a7041`, moss-deep `#3f5036`, rule `rgba(35,29,20,0.16)`.
- No em dashes anywhere in copy or code comments.
- Every UI task uses Playwright screenshots as a feedback loop (before, during, after), at 1440×900 and 375×812. Scripts live in `scripts/ui-check/` and are never part of `npm test`.
- `npm test` must be green at the end of every task. `npm run build` must succeed at the end of tasks 1, 4, 9, 12.
- Dev server for checks: `npx next dev -p 3111` (port 3111 is what the orchestrator's browser is attached to).

---

### Task 0: Playwright check harness

**Files:**
- Create: `scripts/ui-check/shot.mjs`
- Create: `scripts/ui-check/README.md`

**Produces:** `node scripts/ui-check/shot.mjs <path> <name> [--mobile] [--wait ms]` writes `scripts/ui-check/out/<name>-{desktop|mobile}.png` from `http://localhost:3111<path>`. Every later task calls this.

- [ ] Write `shot.mjs` using `playwright`'s bundled Chromium: parse args, launch, set viewport 1440×900 (or 375×812 with `isMobile: true, hasTouch: true` when `--mobile`), `goto`, `waitForTimeout(wait ?? 2500)`, screenshot full page, print the path. Also expose `--eval "<js>"` that prints `JSON.stringify(await page.evaluate(js))` so tasks can assert computed styles.
- [ ] Add `scripts/ui-check/out/` to `.gitignore`.
- [ ] Start the dev server, run `node scripts/ui-check/shot.mjs / baseline-home` and `--mobile`; confirm PNGs exist.
- [ ] Commit: `chore: add playwright ui-check harness`.

---

### Task 1: Restore the Tailwind v4 design tokens

**Files:**
- Modify: `src/app/globals.css` (the `@theme` block)
- Delete: `tailwind.config.ts`
- Test: `src/lib/tokens.test.ts`

**Produces:** working utilities `font-display`, `font-serif`, `font-mono`, `text-tiny`, `text-small`, `text-body`, `text-h3`, `text-h2`, `text-h1`, `text-display`, `max-w-prose`, `max-w-text`, `max-w-list`, `max-w-page`, 180ms default transition.

- [ ] Write the failing test: read `src/app/globals.css` as text and assert it contains `--font-display:`, `--text-tiny:`, `--text-h1:`, `--container-page: 1180px`, `--default-transition-duration: 180ms`. Run `npx vitest run src/lib/tokens.test.ts`; expect FAIL.
- [ ] Add to the existing `@theme` block exactly the tokens listed in spec §4.1 (fonts, text sizes with `--line-height`/`--letter-spacing` companions, containers, transition). Keep the color tokens.
- [ ] Delete `tailwind.config.ts`. Grep `src` for `font-display|font-serif|font-mono|text-tiny|text-h1|max-w-page|max-w-text|max-w-list` and confirm every class now resolves (no changes expected to the TSX).
- [ ] Run the test; expect PASS. Run `npm run build`; expect success.
- [ ] Playwright check on `/projects`: `--eval` that returns `getComputedStyle(document.querySelector('h1')).fontFamily`, nav link font-family, `p.font-mono` font-size, and `main > div` width. Expect `Cormorant Garamond…`, `Newsreader…`, `10px`, `1180`. Mobile: `h1` font-size `44px`.
- [ ] Screenshot `/`, `/about`, `/projects`, `/research`, `/art` desktop + mobile and compare to the Task 0 baselines. The mono meta lines should now be small tracked caps; page titles on mobile should be large.
- [ ] Commit: `fix(styles): move design tokens into tailwind v4 @theme`.

---

### Task 2: Route group and bare home layout

**Files:**
- Create: `src/app/(pages)/layout.tsx` (the padded `mx-auto max-w-page px-6 sm:px-10 md:px-16 py-10` wrapper, moved from `src/app/layout.tsx`)
- Move: `src/app/{about,art,music,projects,research}/**` and `src/app/not-found.tsx` under `src/app/(pages)/`
- Modify: `src/app/layout.tsx` (keep header, `<main className="flex-1">`, footer; drop the padded div)
- Modify: `src/app/page.tsx` (temporary: a full-width section; real hero comes in Task 3)

**Produces:** `/` renders with no page padding; all other URLs unchanged.

- [ ] `git mv` each route folder and `not-found.tsx` into `src/app/(pages)/`; create `(pages)/layout.tsx` that returns the padded div around `children`.
- [ ] Remove the padded div from the root layout.
- [ ] Run `npm test`, `npm run build`; visit `/about`, `/projects/binsight`, `/research/dialong`, `/art/albums`, `/nope` with Playwright and confirm each renders identically to Task 1 screenshots (padding intact) and `/` has zero horizontal padding.
- [ ] Commit: `refactor(app): route group for padded pages, bare root for hero`.

---

### Task 3: Home hero (Option B) with caption card and always-visible controls

**Files:**
- Create: `src/components/home/HomeHero.tsx` (server component: full-bleed container + `<MusicMapClient />` + `<HeroCaption />` + `<HeroControls />` slots)
- Create: `src/components/home/HeroCaption.tsx`
- Modify: `src/app/page.tsx` (renders `<HomeHero />`)
- Modify: `src/components/layout/SiteHeader.tsx` (accept `overlay?: boolean`; when true, position absolute over the hero with the paper gradient; root layout passes `overlay` when `pathname === '/'`)
- Modify: `src/components/music-map/MusicMap.tsx` (remove `hovered`/`chromeFocused` reveal; `Slider` and `SearchOverlay` always mounted and visible)
- Modify: `src/components/music-map/overlays/Slider.tsx` and `SearchOverlay.tsx` (restyle as the bottom-right pills in the mockup: 36px tall, `rule` border, `paper-soft` at 92%, mono tiny uppercase; search is a button that opens the existing overlay)
- Modify: `src/lib/site-config.ts` (delete `tagline`)
- Test: `src/components/home/HeroCaption.test.tsx`

**Interfaces:**
- `HomeHero` props: none. Height: `calc(100vh - 0px)` with `min-height: 560px`; the header overlays it.
- `HeroCaption` renders `<h1>` (display, 27px), `<p>` body, `<p>` mono hint, in a 380px card bottom-left (`left: 48px; bottom: 40px`), collapsing to full-width below 640px (mobile layout is refined in Task 11).

- [ ] Write the failing test: render `<HeroCaption />`, assert the three exact strings from Global Constraints are present and the `h1` has class `font-display`.
- [ ] Implement `HeroCaption`, `HomeHero`, header overlay mode, `page.tsx`.
- [ ] Remove the hover-reveal from `MusicMap.tsx`; restyle slider/search; delete `siteConfig.tagline` and its test references if any.
- [ ] Run `npm test`; expect PASS. Playwright screenshot `/` at desktop: map edge to edge under the header, caption card bottom-left, slider + search bottom-right visible without hovering. Compare against the "Home · B" artboard in the mockup.
- [ ] Commit: `feat(home): full-bleed map hero with caption card and visible controls`.

---

### Task 4: Store and tuning cleanup (camera-grab split, single preset, no tour)

**Files:**
- Modify: `src/components/music-map/state/store.ts` (add `lastCameraGrab: number` and `registerCameraGrab(): void`; debounce `saveToSession` 250ms; remove `window.__mapStore`)
- Modify: `src/components/music-map/state/tuning.ts` (single exported `TUNING` const, no presets, no store, no `window.__tune`)
- Delete: `src/components/music-map/canvas/AutoTour.tsx`, `overlays/TuneHud.tsx`, `canvas/RegionWashes.tsx`, `canvas/BackgroundLayer.tsx`, `shaders/wash.ts`
- Modify: `src/components/music-map/canvas/Scene.tsx` (remove `QAExpose`, `AutoTour`, drei import; pass `camera={{ zoom: 2.4, position: [0,0,5], near: 0.1, far: 100, left: -0.75, right: 0.75, top: 0.55, bottom: -0.55 }}` to `<Canvas orthographic>`)
- Modify: `src/components/music-map/MusicMap.tsx` (remove `TuneHud`)
- Modify: `src/components/music-map/canvas/FlyToFocus.tsx`, `AmbientDrift.tsx`, `CameraBounds.tsx` (read `TUNING` instead of `useTuningStore`; `FlyToFocus` cancels on `lastCameraGrab > startWall` only)
- Test: `src/components/music-map/state/store.test.ts` (extend)

**Interfaces:**
```ts
// tuning.ts
export const TUNING = {
  driftAmplitude: 0.08,
  driftFreqHz: 1 / 8,
  driftIdleDelayMs: 10_000,
  overviewZoom: 2.4,
  focusZoom: 3.4,
  focusFlyDurationMs: 550,
  focusReleaseDurationMs: 320,
} as const;
// store.ts additions
lastCameraGrab: number;           // pointerdown-drag, wheel, slider drag only
registerCameraGrab(): void;
```

- [ ] Write failing store tests: `registerCameraGrab` sets `lastCameraGrab` and does not touch `lastInteraction`; `setSliderT` twice within 250ms writes `sessionStorage` once (use fake timers).
- [ ] Implement store changes; implement `TUNING`; delete the listed files; fix imports; remove `AutoTour` and `QAExpose` from `Scene.tsx`; remove drei.
- [ ] In `FlyToFocus.tsx` change the cancel condition to `useMapStore.getState().lastCameraGrab > a.startWall` and switch easing to `easeOutCubic` (`1 - Math.pow(1 - t, 3)`). Remove `sliderT` from the effect deps; instead, when `sliderT` changes while an animation runs, recompute `toPos` in place.
- [ ] In `CameraRig.tsx` call `registerCameraGrab()` on pointerdown, on the first move of a drag, and on wheel; keep `registerInteraction()` on every move (drift gating).
- [ ] Run `npm test`, `npm run build`; grep confirms no remaining references to `useTuningStore`, `PRESETS`, `TuneHud`, `AutoTour`, `@react-three/drei`.
- [ ] Playwright on `/`: click a dense area, immediately wiggle the mouse 20px, wait 800ms, `--eval` `window.__mapThree` is gone, so instead read the camera through a test hook: export `getCameraState()` from a tiny `state/debug.ts` that only registers in `process.env.NODE_ENV !== 'production'`. Assert `zoom` moved from 2.4 toward 3.4 despite the wiggle.
- [ ] Commit: `refactor(music-map): single tuning const, camera-grab split, remove tour and dead code`.

---

### Task 5: Refs instead of React state on the hot path, and on-demand rendering

**Files:**
- Modify: `src/components/music-map/canvas/Scene.tsx` (`SceneInner` holds `cursorRef = useRef<[number, number] | null>(null)` and `zoomRef = useRef(2.4)`; no `useState` for either)
- Modify: `src/components/music-map/canvas/CursorTracker.tsx` (writes `cursorRef.current`, calls `invalidate()`)
- Modify: `src/components/music-map/canvas/CameraRig.tsx` (writes `zoomRef.current = camera.zoom` in `useFrame`; no `onZoomT` callback)
- Modify: `src/components/music-map/canvas/AlbumField.tsx` (reads both refs in `useFrame` to set `u_cursor`, `u_cursorActive`, `u_zoomT = (zoom - 0.5) / 4.5`)
- Modify: `src/components/music-map/canvas/AtlasManager.tsx` (`useAtlasTextures(urls, cameraRef)` reads `camera.zoom` each frame via `useFrame` and flips a local state only when a threshold is crossed)
- Modify: `src/components/music-map/canvas/Scene.tsx` `<Canvas frameloop="demand" gl={{ alpha: false, antialias: false }} dpr={[1, 2]}>`
- Every animator (`AmbientDrift`, `FlyToFocus`, `CameraBounds`, slider handler, pointer handlers) calls `invalidate()` from `useThree` while it has work; drift calls it once per frame while active.

- [ ] Add a React Profiler assertion script `scripts/ui-check/profile-moves.mjs`: mounts nothing new; it uses Playwright to dispatch 60 `pointermove` events over 1s on the canvas and reads `window.__mapCommits` (a dev-only counter incremented in a `useEffect` without deps inside `SceneInner`, registered in `state/debug.ts`). Baseline: 60+. Target after: 0.
- [ ] Implement the ref plumbing and `frameloop="demand"` with `invalidate()` calls.
- [ ] Run `npm test`, then the profiler script: expect 0 commits during pointermove, and a screenshot 2s after load identical to one 6s after load with no pointer (no rendering while idle before the 10s drift).
- [ ] Commit: `perf(music-map): refs on the hot path, demand frameloop, no MSAA`.

---

### Task 6: Hover hit-testing, cursor, ring, and a DOM-driven tooltip

**Files:**
- Create: `src/components/music-map/state/hitTest.ts` with `export function nearestWithin(positions: Float32Array, n: number, x: number, y: number, radiusWorld: number): number` (returns index or -1; flat `[x0,y0,x1,y1,...]` array of the current interpolated positions, maintained by `AlbumField` once per `sliderT` change)
- Modify: `src/components/music-map/canvas/CursorTracker.tsx` (per frame, at most once: compute `hoverIndex`, set `canvas.style.cursor`, write `hoverRef.current`)
- Modify: `src/components/music-map/shaders/album.ts` (add `uniform float u_hoverIndex`; hovered sprite `scale = 1.25`; fragment draws a 1px ink ring inside a 2px paper ring when `v_hovered > 0.5` using `r` thresholds)
- Modify: `src/components/music-map/overlays/Tooltip.tsx` (render once; a `ref`; positioned by `TooltipDriver`)
- Create: `src/components/music-map/canvas/TooltipDriver.tsx` (inside the canvas; `useFrame` projects the hovered-or-focused album position with `camera.project` and the cached canvas rect, writes `style.transform` and `style.opacity` on the tooltip element; caches the rect on `resize`)
- Delete: `src/components/music-map/canvas/ProjectionBridge.tsx` and the two `CustomEvent`s
- Modify: `src/components/music-map/overlays/Tooltip.tsx` copy: `<b>{title}</b> · {artist}` and append ` · {year}` only when `year > 0`
- Test: `src/components/music-map/state/hitTest.test.ts`, `src/components/music-map/overlays/Tooltip.test.tsx`

**Interfaces:**
- Hover radius: 14 CSS px converted to world units as `14 / (camera.zoom * canvasHeightPx / (top - bottom))`.
- Tooltip shows 80ms after hover starts (timer in `CursorTracker`), immediately on focus; hides on hover-out unless focused.

- [ ] Write failing tests: `nearestWithin` returns the closest index inside the radius and -1 outside; `Tooltip` omits the year when 0 and includes it when 1973.
- [ ] Implement hit-test, shader ring, `TooltipDriver`, tooltip changes; delete `ProjectionBridge`.
- [ ] Run `npm test`. Playwright: hover the densest area and `--eval` `getComputedStyle(canvas).cursor === 'pointer'` and that the tooltip element has opacity 1 within 200ms; screenshot shows the ring.
- [ ] Commit: `feat(music-map): hover hit-testing with ring, cursor, and DOM-driven tooltip`.

---

### Task 7: Zoom to cursor with smoothing, pointer capture, averaged fling

**Files:**
- Create: `src/components/music-map/state/zoomMath.ts` with `export function anchoredZoom(cam: {x: number; y: number; zoom: number}, cursorWorld: [number, number], nextZoom: number): {x: number; y: number}` returning the camera position that keeps `cursorWorld` fixed on screen.
- Modify: `src/components/music-map/canvas/CameraRig.tsx` (`targetZoom` ref; wheel sets target with `factor = 1 - deltaY * (e.ctrlKey ? 0.00075 : 0.0015)`; `useFrame` moves `camera.zoom` toward target with `zoom += (target - zoom) * (1 - Math.exp(-dt / 0.09))`, then repositions with `anchoredZoom` using the anchor stored at wheel time; `setPointerCapture` on down, `releasePointerCapture` on up; velocity = mean of the last 3 move deltas)
- Test: `src/components/music-map/state/zoomMath.test.ts`

- [ ] Write the failing test: for cam `{0,0,2}`, cursor `[0.2,0.1]`, nextZoom 4, the returned position projects the cursor to the same screen point (compute both projections in the test with the orthographic formula `screen = (world - cam) * zoom`).
- [ ] Implement `anchoredZoom` and the rig changes.
- [ ] Run `npm test`. Playwright: wheel 3 ticks over a point at (900, 400); screenshot before and after; the sprite under the cursor stays under the cursor (assert via `getCameraState()` and the projection formula, tolerance 2px).
- [ ] Commit: `feat(music-map): cursor-anchored smoothed zoom, pointer capture, averaged fling`.

---

### Task 8: Overview look: tinted discs, cover crossfade, dim shrink, region labels

**Files:**
- Modify: `src/components/music-map/shaders/album.ts` (dot color = `clusterColor(id)`; crossfade between 24 and 40 CSS px; dimmed `scale = 0.85`; clamp `gl_PointSize` to `min(240, u_maxSpritePx)`)
- Modify: `src/components/music-map/canvas/AlbumField.tsx` (set `u_maxSpritePx = viewportHeightPx * 0.18 * dpr`)
- Create: `src/components/music-map/state/centroids.ts` with `export function clusterCentroids(positions: Float32Array, clusterIds: Uint8Array, n: number, k: number): Float32Array` (mean x,y per cluster)
- Rewrite: `src/components/music-map/canvas/RegionLabels.tsx` as a DOM overlay driver (like `TooltipDriver`): one `<span>` per region, italic `font-display` 22px, color = region color, opacity `clamp(1 - (zoomT - 0.3) / 0.15, 0, 1)`, positioned each frame from the centroids at the current `sliderT`
- Modify: `src/components/music-map/canvas/Scene.tsx` (mount `RegionLabels`)
- Test: `src/components/music-map/state/centroids.test.ts`

- [ ] Write the failing centroid test (two clusters, known means).
- [ ] Implement shader changes, `u_maxSpritePx`, centroids, labels.
- [ ] Run `npm test`. Playwright: overview screenshot shows solid coloured discs and six-to-eight italic labels; zoom in until sprites exceed 40px and confirm covers at full opacity and labels gone. Click an album and confirm non-neighbours are dimmed and smaller.
- [ ] Commit: `feat(music-map): tinted overview discs, cover crossfade, region labels`.

---

### Task 9: Load path: full dataset, preload, lazy off-thread atlases, cache headers, narrow guard

**Files:**
- Modify: `src/components/music-map/data/loader.ts` (`SAMPLE_LIMIT = Infinity`; delete `pickSampledIds` if now unused; export `startPrefetch(base: string): Promise<MapData>` that memoises one in-flight promise on `globalThis`)
- Modify: `src/components/music-map/MusicMapClient.tsx` (call `startPrefetch('/data')` at module scope, guarded by `typeof window !== 'undefined' && !window.matchMedia('(max-width: 639px)').matches`)
- Modify: `src/components/music-map/MusicMap.tsx` (use `startPrefetch` result; `isNarrow` initialised from `matchMedia` in the `useState` initialiser; if the store already has data, skip the fetch)
- Modify: `src/app/page.tsx` (three `<link rel="preload" as="fetch" crossOrigin="anonymous">` for the JSON files)
- Modify: `src/components/music-map/canvas/AtlasManager.tsx` (`ImageBitmapLoader` with `{ imageOrientation: 'none', premultiplyAlpha: 'none' }`, `flipY = false`; load atlas-0 when `camera.zoom >= 1.6`, then the others in order of visible-sprite reference counts, one at a time)
- Modify: `next.config.mjs` (`headers()` for `/data/:path*`: `public, max-age=86400, stale-while-revalidate=604800`)
- Test: `src/components/music-map/data/loader.test.ts` (extend: no sampling; `startPrefetch` returns the same promise twice)

- [ ] Write failing loader tests.
- [ ] Implement.
- [ ] Run `npm test`, `npm run build`. Playwright with `page.route` counting: exactly one request each for the three JSON files on `/`; no atlas request before the first zoom past 1.6; on mobile viewport zero `/data` requests before the map mounts (Task 11 will mount it).
- [ ] Performance check at 1440×900 with CDP `Network.emulateNetworkConditions` Fast 3G: dots visible under 1.5s after navigation.
- [ ] Commit: `perf(music-map): full dataset, prefetch, lazy off-thread atlases, cache headers`.

---

### Task 10: Fix `/music`

**Files:**
- Modify: `src/app/(pages)/music/page.tsx` and whatever the root cause is (suspects: `MusicMap.tsx` effect deps; `<Canvas>` needs `resize={{ scroll: false, debounce: 0 }}` or the container needs explicit height; the store singleton already holding data)

- [ ] Reproduce with Playwright: `--eval` returns `document.querySelector('canvas').width` (currently 300) and count `/data` requests over 5s (currently dozens).
- [ ] Find the root cause with a minimal instrumented repro before changing code; write it down in the commit body.
- [ ] Fix. Playwright: canvas width equals its container width × dpr, three `/data` requests total (or zero if the home page was visited first in the same session), the essay renders below.
- [ ] Commit: `fix(music): map sizes to its container and fetches once`.

---

### Task 11: Touch map on mobile

**Files:**
- Modify: `src/components/music-map/MusicMap.tsx` (narrow no longer returns `MobileFallback`; passes `variant: 'touch'` down; `MobileFallback` only for missing WebGL)
- Modify: `src/components/music-map/canvas/CameraRig.tsx` (track active pointers in a `Map`; two pointers → pinch: zoom factor = current distance / start distance, anchored at the midpoint via `anchoredZoom`; `touch-action: none` on the canvas)
- Create: `src/components/music-map/overlays/MobileSheet.tsx` (bottom card inside the map: title, artist, year when > 0; "tap a point" when nothing is focused)
- Modify: `src/components/home/HomeHero.tsx` and `HeroCaption.tsx` (below 640px: map is 390px tall, caption renders in flow below it, no search)
- Modify: `src/components/music-map/canvas/Scene.tsx` (`dpr={[1, isTouch ? 1.5 : 2]}`)
- Test: `src/components/music-map/state/zoomMath.test.ts` (extend with `pinchZoom(startDist, currDist, startZoom)` clamped to [0.5, 5])

- [ ] Write the failing pinch test.
- [ ] Implement.
- [ ] Playwright mobile: screenshot `/` shows the map at 390px with labels, the sheet reading "tap a point", the caption below. `page.touchscreen.tap` on a dense point: sheet shows a title. Two-finger pinch via CDP `Input.dispatchTouchEvent`: zoom increases.
- [ ] Commit: `feat(music-map): touch map on mobile with pinch, tap, and bottom sheet`.

---

### Task 12: Favicon, OG image, metadata

**Files:**
- Create: `src/app/icon.svg` (32×32, paper background, moss circle radius 10 centred)
- Create: `src/app/opengraph-image.tsx` (`ImageResponse`, 1200×630, paper background, "samer aslan" in the display face loaded via `fetch` of the Google Fonts file at build, the caption heading line, and 60 deterministic cluster-coloured discs using the region palette)
- Modify: `src/app/layout.tsx` (`metadataBase: new URL('https://www.sameraslan.com')`, `openGraph: { title, description, url, siteName, type: 'website' }`, `twitter: { card: 'summary_large_image' }`)

- [ ] Implement. `npm run build`. Playwright `--eval` on `/`: `link[rel=icon]` exists, `meta[property="og:image"]` exists and its URL returns 200 with `image/png`. Open `/opengraph-image` in the orchestrator's browser and eyeball it.
- [ ] Commit: `feat(meta): favicon, open graph image, social metadata`.

---

### Task 13: Final verification sweep

- [ ] `npm test`, `npm run build`, `npm run lint` all green.
- [ ] Playwright screenshots of every route at both sizes into `scripts/ui-check/out/final-*`; orchestrator reviews them in the browser.
- [ ] Performance gate from spec §5 on `/`: click-to-settle < 700ms, 0 React commits on pointermove, dots < 1.5s on Fast 3G, texture memory < 60MB before first zoom (read via `renderer.info.memory.textures` count and known sheet size).
- [ ] Update `src/components/music-map/README.md`: state machine (no tour), file layout (deleted files), tuning const, performance budget actuals.
- [ ] Commit: `docs(music-map): update README for the improvement pass`.

---

### Task 14: About page layout (content frozen)

Added 2026-09-26 after the owner's mid-pass request. The bio TEXT in `AboutHeader.tsx` stays byte-for-byte identical; only layout, links, and a facts sidebar change.

**Files:**
- Modify: `src/components/content/AboutHeader.tsx` (layout only)
- Create: `src/components/content/AboutFacts.tsx` (the `<dl>` sidebar)
- Modify: `src/app/(pages)/about/page.tsx` if the grid needs to move up a level
- Test: `src/components/content/AboutHeader.test.tsx`

**Layout (desktop, matches the "About" artboard):** two columns `minmax(0,1fr) 260px`, gap 64px, inside `PageFrame`. Left: `PageTitle` "about", then the existing paragraphs and list unchanged (max-width 60ch), then a row of italic moss links `email →`, `github →`, `linkedin →` using `siteConfig.external` hrefs. Right (`aside`, padding-top 14px): the 220px round avatar (existing mask kept), then `AboutFacts`.

**`AboutFacts`:** a `<dl>` of rows, each `dt` mono tiny uppercase ink-muted, `dd` serif 15px: `now` → "AI and law, Bloomberg LP"; `before` → "Johns Hopkins, CLSP and Dynamic Perception Lab"; `where` → "Brooklyn, New York"; `listening lately` → italic placeholder "coming soon, from Spotify" (data wiring is deferred to the pipeline revamp). Values live in `src/lib/site-config.ts` as `siteConfig.facts: { now, before, where }` so they can be corrected without touching components. Remove the old "Brooklyn, New York" caption under the photo (it moves into the facts).

**Mobile (< 640px):** avatar first (centred, 160px), then facts, then the bio, then links.

- [ ] Write the failing test: render `<AboutHeader />`; assert the three link hrefs (`mailto:samer.aslan@gmail.com`, `https://github.com/sameraslan`, `https://www.linkedin.com/in/sameraslan/`), the four `dt` labels, and that the first bio paragraph text is exactly the current string (copy it from the component into the test so any wording change fails the test).
- [ ] Implement. `npm test` green. Playwright `/about` desktop + mobile screenshots compared with the artboard.
- [ ] Commit: `feat(about): facts sidebar and contact links, bio text unchanged`.
