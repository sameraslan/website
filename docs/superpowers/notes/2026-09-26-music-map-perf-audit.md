# Music map performance and responsiveness audit (2026-09-26)

Read-only audit of `src/components/music-map/**`, `src/app/page.tsx`, `src/app/music/page.tsx`, `next.config.mjs`, `public/data/*`. Line numbers refer to commit `d451813`.

Dataset on disk is 4,081 albums; `loader.ts` subsamples to 500 at runtime.

Measured:
- `positions.json` 861 KB raw / 344 KB gzip; `metadata.json` 1,165 KB raw / 201 KB gzip; `regions.json` 2.8 KB.
- Four atlases at 3072×3072 WebP: 2.41 / 2.33 / 2.23 / 2.37 MB, ~9.3 MB total.
- Decoded GPU footprint per atlas ≈ 50 MB with mipmaps; all four ≈ 200 MB (README budget says < 80 MB).

## 1. Load path

- **1a** Serial waterfall: HTML → app chunk → music-map chunk (three/R3F) → `useEffect` fetch (`MusicMap.tsx:56-70`) → parse → `setData` → `<Scene>` → WebGL → atlas fetch. Nothing preloads `/data/*`. Fix: `<link rel="preload">` and/or start `fetchMapData()` at module scope in `MusicMapClient.tsx`.
- **1b** 4,081 records downloaded to render 500 (`loader.ts:12`, `:152-160`).
- **1c** JSON bloat: 17-digit floats, `spotifyUrl` derivable from `id`, `popularity` unused.
- **1d** All four atlases load immediately: gate at `AtlasManager.tsx:53` is `camZoom >= 1.05`, and `Scene.tsx:81` maps `zoomT` to `[0.5, 8]` (real range is `[0.5, 5]`, `CameraRig.tsx:9-13`), so the initial zoom 2.4 → `camZoom` 3.67 → gate true on frame 1.
- **1e** `TextureLoader` + `generateMipmaps` on the main thread (`AtlasManager.tsx:7,21`): 50–150 ms hitch four times during the first seconds. Fix: `ImageBitmapLoader`.
- **1f** No cache headers for `/data` (`next.config.mjs` has no `headers()`).
- **1g** Fetch fires on narrow screens before `matchMedia` corrects `isNarrow` (`MusicMap.tsx:37,48,56`).
- **1h** drei imported only for `OrthographicCamera` (`Scene.tsx:5`).

## 2. Per-frame hot path

- **2a** `CursorTracker.tsx:25` → `setCursorWorld` (`Scene.tsx:74,106`) re-renders the whole scene subtree per pointermove to move a `vec2` uniform.
- **2b** `CameraRig.tsx:81-86` → `setZoomT` (`Scene.tsx:73,103`) re-renders per zoom frame; `useAtlasTextures` effect re-runs.
- **2c** Tooltip: rAF loop + two `CustomEvent`s + `getBoundingClientRect` + `setPos` per frame (`Tooltip.tsx:26-39`, `ProjectionBridge.tsx:12-24`); `metadata.find` O(n) per render (`Tooltip.tsx:51`).
- **2d** `registerInteraction()` on every pointermove (`CameraRig.tsx:38`) notifies all store subscribers.
- **2e** `getMainBounds` string-key memo with `toFixed` per frame (`bounds.ts:41`, `CameraBounds.tsx:59`); `getCurrentViewport` allocates per frame (`CameraBounds.tsx:56`).
- **2f** `positions.find` in `useFrame` during focus orbit (`AmbientDrift.tsx:64,88`).
- **2g** KNN/hit-test fine at 500; `FocusController.tsx:63-74` rebuilds Maps + sorts per slider move while focused.
- **2h** `sessionStorage.setItem` per slider pointermove (`store.ts:76`).
- **2i** `FlyToFocus.tsx:137` restarts the 6 s glide (new random arc) on every slider move.
- **2j** `AlbumField` frame work is fine (`AlbumField.tsx:124-144`).

## 3. Interaction latency

- **3a** No hover feedback: no cursor change, no ring, tooltip only on click (`Tooltip.tsx:20`).
- **3b** Click glide cancelled by any pointer movement > 1 ms after the click: `FlyToFocus.tsx:153` aborts when `lastInteraction > startWall`, and `CameraRig.tsx:38` sets `lastInteraction` on every pointermove.
- **3c** `focusFlyDurationMs: 6_000` with `easeInOutCubic` (`tuning.ts:48`, `FlyToFocus.tsx:158`): ~6% moved after 1.5 s.
- **3d** Release 900 ms ease-in-out (`tuning.ts:49`).
- **3e** Tour and drift begin at 0 s (`AutoTour.tsx:66`, `AmbientDrift.tsx:25` `mountedAt = 0`) with 5 s idle delays; on interruption `AutoTour.tsx:185-190` drops its claim but never clears `focusedId`, so `mode` stays `"focus"` and `v_dim = 0.7` keeps the map washed out.
- **3f** Wheel zoom about the camera centre, 15 % per notch, no pinch distinction (`CameraRig.tsx:52-58`).
- **3g** Drag: no `setPointerCapture`; velocity from the last single frame.
- **3h** `matchMedia` per frame (`AutoTour.tsx:178`, `AmbientDrift.tsx:58`).

## 4. Rendering

- **4a** ~200 MB textures for 500 sprites; 4 samplers behind data-dependent branches (`album.ts:99-104`).
- **4b** `antialias: true` on a points-only scene (`Scene.tsx:49`).
- **4c** `frameloop="always"` (default); renders 60 fps while idle and hidden.
- **4d** DPR default `[1, 2]`; `u_pixelRatio` set once (`AlbumField.tsx:97`).
- **4e** Overdraw bounded at 500; at 4,081 with 240 px sprites ≈ 235 M fragments worst case.
- **4f** Dimmed sprites blend near-paper over paper (`album.ts:154`); shrink instead.

## 5. Dead code

`RegionLabels.tsx`, `RegionWashes.tsx`, `shaders/wash.ts`, `BackgroundLayer.tsx` (not imported); `TuneHud.tsx` shipped and mounted in prod (`MusicMap.tsx:12,164`, global keydown at `TuneHud.tsx:92`); `QAExpose` (`Scene.tsx:25-41`), `window.__mapStore` (`store.ts:85-87`), `window.__tune` (`tuning.ts:127-129`); `loader.ts:15` `onProgress` never passed; `LoadingState` hides before any atlas arrives.

## Prioritised top 10

1. Split `lastInteraction` into hover vs camera-grab; cancel glides only on grabs.
2. User fly-to ≈ 500 ms `easeOut`; release ≈ 350 ms.
3. Hover hit-testing with cursor, ring, tooltip.
4. Zoom toward the cursor with a short smoothing constant.
5. Move `cursorWorld` and `zoomT` out of React state.
6. Lazy atlases on real camera zoom via `ImageBitmapLoader` (single sheet or KTX2 later).
7. Preload data; start the fetch before the three chunk evaluates.
8. Remove the idle tour's dimming and focus stealing.
9. `antialias: false`; `frameloop="demand"`.
10. Tooltip via direct DOM transform; drop CustomEvents; stop `FlyToFocus` restarting on slider; debounce sessionStorage.
