# `<MusicMap />`

Hero feature of sameraslan.com. Renders ~5,000 albums as a continuous 2D
embedding on cream paper. Proximity encodes similarity; the slider warps the
embedding between three pre-baked projections; clicking (or tapping) an
album surfaces its 10 nearest neighbors.

## How it works

```
┌────────────────────────┐    ┌────────────────────────┐
│  Python pipeline       │    │  <MusicMap /> (React)  │
│  ─────────────────     │    │  ──────────────────    │
│  albums.csv            │    │  • R3F canvas          │
│      ↓                 │    │  • Single InstancedMesh│
│  Spotify API           │    │    for 5k albums       │
│  RYM scraper           │    │  • Vertex shader does  │
│      ↓                 │    │    piecewise-linear    │
│  Feature matrices      │    │    interpolation       │
│      ↓                 │    │    between 3 stops     │
│  UMAP (3 stops)        │───▶│  • Atlas textures load │
│  KMeans (8 clusters)   │ JSON│   lazily as zoom      │
│  Cover atlasing        │+WebP│   crosses thresholds  │
│      ↓                 │    │  • Click → KNN over   │
│  public/data/*.json    │    │    current projection │
│  public/data/atlas-*   │    │    in <5ms             │
└────────────────────────┘    └────────────────────────┘
```

## Data shape

- `public/data/positions.json`: `{id, audio:[x,y], balanced:[x,y], mood:[x,y]}` per album
- `public/data/metadata.json`: `{id, title, artist, year, spotifyUrl, clusterId, atlasIndex, atlasUV}` ordered by `clusterId` then by descending `popularity`
- `public/data/regions.json`: `{clusterId, label, color, stops:{audio,balanced,mood:{centroid,radius}}}`
- `public/data/atlas-N.webp`: 1024-sprite atlases (96×96 each on a 3072×3072 sheet)

All produced by `python pipeline/build.py`. See `pipeline/README.md` for details.

## Public API

```tsx
import { MusicMap } from "@/components/music-map";

<MusicMap />
```

The component takes no props in v1. It owns its own canvas, state (via Zustand
under the hood), and overlays (tooltip/sheet, slider, search). The parent
just needs to give it a sized container. On the home page it renders
full-bleed above 640px and drops to a fixed 390px-tall block in normal flow
below it (see `HomeHero.tsx`); the data preload in `app/page.tsx` uses
`ReactDOM.preload` so it fires once per session regardless of client
navigation.

## Updating content

**To add or remove albums:**
```bash
# Edit pipeline/sources/albums.csv (one row per album)
python pipeline/build.py
git add public/data && git commit -m "data: update music map"
```

**To swap projection algorithms (UMAP → t-SNE → PCA):**
Edit `pipeline/config.yaml`'s `projection.algorithm` value, re-run `build.py`.
Manifest hashing reruns only the affected steps.

**To re-color regions:**
Edit `pipeline/config.yaml`'s `cluster_palette` entries. The labels are
auto-assigned to kmeans clusters via Hungarian matching against
`FEATURE_SIGNATURES` in `04_project.py`. To force a specific assignment,
override there.

**To retune camera/drift feel:**
Edit `state/tuning.ts`'s `TUNING` object (drift amplitude/frequency/idle
delay, overview/focus zoom, fly/release durations). There is a single fixed
preset, not a dev HUD or a set of alternate presets to switch between.

## State machine

Four `MapMode` values (`state/store.ts`): `loading`, `idle`, `interactive`,
`focus`. There is no auto-tour (removed; see "Removed" below), so in
practice the map only ever moves between three of them:

```
loading  ──data fetched──▶  idle  ──album click / tap──▶  focus
                            ▲                                │
                            └────────────focus(null)─────────┘
              (Escape, a click or tap on empty map, or focus a new album)
```

Escape is a document-level `keydown` handler in `FocusController.tsx`: it
releases focus whenever an album is focused and no text field (the search
input) has keyboard focus. Clicks and taps use the same hit test as hover
(`state/hitTest.ts` `nearestWithin` over AlbumField's interpolated
positions) with a CSS-px radius converted to world units at the current
zoom: 14px for a mouse, 24px for touch and pen. A click farther than that
from every disc releases focus.

`FlyToFocus.tsx` captures the camera's position and zoom when focus begins
from an unfocused state (album-to-album hops keep the original) and a release
glides both back to it (`releaseView` in `state/view.ts`), falling back to
the fitted overview centre and zoom when nothing was captured. Each focus
from an unfocused state eases in to `TUNING.focusZoom` (or keeps a closer
user zoom); hops keep the current zoom.

`interactive` is declared on `MapMode` but nothing currently transitions the
store into it; it is a placeholder from before the tour was removed and is
not part of the live state machine. `idle` covers hover, drag/pan, wheel/pinch
zoom, and ambient drift alike, none of which are distinct modes of their own,
just store fields (`hoveredId`, `dragging`, `lastCameraGrab`, `lastInteraction`)
that individual components (`CameraRig`, `AmbientDrift`, `CameraBounds`) read
directly.

## Render model: demand mode

`<Canvas frameloop="demand">` (`Scene.tsx`): nothing redraws unless something
explicitly asks it to via R3F's `invalidate()`. `state/invalidate.ts` bridges
that call out to code outside the fiber tree (the Slider DOM overlay,
`store.ts`'s `setSliderT`) so they can request a render without importing
`@react-three/fiber` themselves. Interactions that request a frame: pointer
drag/zoom (every frame while active), a slider change, a focus change, an
atlas texture arriving, the final frame of a fly-to (so the settled zoom
reaches the sprite-size uniform), and the idle-drift wake timer. A stalled
idle map (no drift, no interaction) is expected to render zero frames until
the next input. Drift never starts while the mouse rests on the canvas.

## Framing: fit-to-cloud, not fit-to-data

The overview zoom and center are **not** a fixed constant; they're computed
per data load (and per resize) by `state/bounds.ts`'s `getCloudBounds` +
`fitZoom`, from the 3rd–97th percentile bounding box of the current
projection, not the full min/max. The real dataset has an outlier group
(≈2% of albums, mostly the "ambient" cluster) far enough out that a min/max
fit would shrink the dense bulk of the cloud into a corner of the frustum.
Percentile framing is recomputed by `InitialFrame.tsx` synchronously on data
load, on canvas resize, and (throttled to at most once per animation frame)
on `sliderT` changes, since each pre-baked projection has a different shape.
`CameraBounds.tsx` uses the same framing box to decide when the idle camera
has wandered far enough off the cloud to nudge back.

## Debug getters

`state/debug.ts` registers `window.__mapDebug` for Playwright/UI-check
harnesses only: it's a no-op in a normal production build (`NODE_ENV`
check), and a production verification run can opt back in with
`NEXT_PUBLIC_MAP_DEBUG=1`. Current getters: `getCameraState`, `getSliderT`,
`getFocusedAlbumPos`, `getNearestScreenPoint`, `getWorldAt`, `getFitState`,
`getNdcInsideFraction`, `getSpriteCssSize`, `getRendererInfo` (renderer
texture/geometry counts, for verifying atlas textures load lazily),
`getHoverIndex` and `getAlbumAt` (hover state and a ground-truth hit test
at a client point, used by `scripts/ui-check/final-fix-check.mjs`), plus the
always-available `firstDrawAt` timestamp and the dev-only `window.__mapCommits`
React-commit counter used by `scripts/ui-check/profile-moves.mjs`.

## Performance budget (actuals, Task 13 verification sweep)

Measured at 1440×900 in Chromium against a production build
(`npm run build && npx next start`) unless noted.

| Metric | Target | Actual | Where measured |
|---|---|---|---|
| Click-to-settle (pointerup → zoom within 0.01 of focus zoom) | < 700ms | ~660ms (3 runs: 654, 673, 656ms) | in-page `requestAnimationFrame` poll of `getCameraState()`, timed from an in-page `pointerup` listener (`task13-perf-gate.mjs`) |
| React commits on pointermove | 0 | 0 | `window.__mapCommits` via `profile-moves.mjs` (dev server) |
| First draw (dots visible), broadband | < 1.5s | ~430ms (420-436ms) | `window.__mapDebug.firstDrawAt` |
| First draw, Fast 3G (CDP throttle) | < 1.5s | ~7.3s, not met | `firstDrawAt`; the critical path is ~0.8-1MB gzip (three.js chunk plus `positions.json` and `metadata.json`), carried to the pipeline revamp (JSON slimming) |
| Atlas textures before the first zoom | 0 | 0 | `getRendererInfo().textures`; grows one atlas sheet at a time (3 textures ~1.5s after a zoom-in click) |

Measured in Chromium at 1440×900 against a production build run with
`NEXT_PUBLIC_MAP_DEBUG=1` so the debug getters are available.

## Visual references

- `docs/superpowers/visual-references/aged-paper-map.html`
- `docs/superpowers/visual-references/blend-zoom.html`

## File layout

```
src/components/music-map/
├── MusicMap.tsx              # top-level: canvas + overlays + bootstrap, isNarrow/webgl checks
├── MusicMapClient.tsx        # "use client" wrapper; module-scope data prefetch on wide screens
├── index.ts
├── canvas/
│   ├── Scene.tsx             # R3F scene root, demand-mode Canvas, debug getters
│   ├── AlbumField.tsx        # the 5k-album InstancedMesh (hot path)
│   ├── AtlasManager.tsx      # lazy atlas loading as zoom crosses thresholds
│   ├── InitialFrame.tsx      # frustum sizing + fit-to-cloud framing + initial snap
│   ├── CameraRig.tsx         # pan + zoom + pinch (touch)
│   ├── CameraBounds.tsx      # nudges idle camera back onto the cloud
│   ├── CursorTracker.tsx     # cursor/pointer → world coords, hit-testing
│   ├── FocusController.tsx   # click/tap → focus + neighbors
│   ├── FlyToFocus.tsx        # camera animation on focus
│   ├── AmbientDrift.tsx      # idle Perlin drift (desktop only, not touch)
│   ├── RegionLabels.tsx      # canvas-side driver: positions the DOM region labels every frame
│   └── TooltipDriver.tsx     # canvas-side driver: positions the DOM tooltip every frame
├── overlays/
│   ├── Tooltip.tsx           # desktop hover tooltip (DOM, outside <Canvas>)
│   ├── MobileSheet.tsx       # touch bottom sheet, replaces Tooltip below 640px
│   ├── RegionLabels.tsx      # DOM region label spans, positioned by canvas/RegionLabels.tsx
│   ├── Slider.tsx            # audio/balanced/mood slider
│   ├── SearchOverlay.tsx     # desktop-only fuzzy search (Fuse.js)
│   └── LoadingState.tsx
├── state/
│   ├── store.ts              # Zustand store (MapMode, sliderT, focus, drag/interaction timestamps)
│   ├── tuning.ts             # fixed camera/drift constants (TUNING); no dev HUD, no presets
│   ├── bounds.ts             # percentile cloud bounds, fit-to-cloud zoom, idle nudge vector
│   ├── breakpoints.ts        # single source of truth for the 640px mobile/desktop cutoff
│   ├── centroids.ts          # per-cluster centroid computation for region labels
│   ├── clusterColors.ts
│   ├── hitTest.ts            # nearest-album hit testing for hover/tap
│   ├── invalidate.ts         # bridges demand-mode invalidate() outside the fiber tree
│   ├── debug.ts              # window.__mapDebug test hooks (see "Debug getters" above)
│   ├── regionLabelEls.ts     # DOM <-> canvas-driver bridge for region label elements
│   ├── tooltipEl.ts          # DOM <-> canvas-driver bridge for the tooltip element
│   ├── view.ts                # published overview framing (zoom/center/bounds) singleton
│   ├── projection.ts         # interpolation + KNN + easing
│   └── zoomMath.ts           # zoom-anchor math (cursor-anchored wheel/pinch zoom)
├── data/
│   ├── loader.ts             # fetch + parse public/data/*.json, module-scope prefetch
│   └── types.ts
└── shaders/
    └── album.ts               # vertex + fragment for the album field (dot/cover crossfade)
```

## Removed

- **`AutoTour.tsx`** and the `interactive` "auto-tour" behavior it drove:
  removed per spec (a fixed idle-drift flourish replaced the scripted camera
  tour). The `interactive` mode name is still declared on `MapMode` (see
  "State machine" above) but nothing sets it anymore.
- **`RegionWashes.tsx`**: removed per
  `docs/superpowers/specs/2026-09-26-website-improvement-design.md` §4.5.7.
  The paper clear color now matches the site background directly, so the map
  reads as part of the page rather than sitting on a colored field.
- **`@react-three/drei`** (npm dependency): removed; nothing under `src`
  imports it, the canvas is built directly on `@react-three/fiber`.

## Future paths

- WebGPU live projection (approach C from brainstorming)
- Spotify OAuth → project visitor's library into our map
- Spotify preview audio on focus
- Auto-refresh GitHub Action (weekly cron over the dataset)

See `docs/superpowers/specs/2026-05-12-music-map-design.md` for the original
design rationale and `docs/superpowers/specs/2026-09-26-website-improvement-design.md`
for the improvement pass (touch support, fit-to-cloud framing, perf work).
