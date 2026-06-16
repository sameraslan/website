# `<MusicMap />`

Hero feature of sameraslan.com. Renders ~5,000 albums as a continuous 2D
embedding on cream paper. Proximity encodes similarity; the slider warps the
embedding between three pre-baked projections; clicking an album surfaces its
10 nearest neighbors.

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
│  public/data/atlas-*   │    │    in <5ms            │
└────────────────────────┘    └────────────────────────┘
```

## Data shape

- `public/data/positions.json` — `{id, audio:[x,y], balanced:[x,y], mood:[x,y]}` per album
- `public/data/metadata.json` — `{id, title, artist, year, spotifyUrl, clusterId, atlasIndex, atlasUV}` ordered by `clusterId` then by descending `popularity`
- `public/data/regions.json` — `{clusterId, label, color, stops:{audio,balanced,mood:{centroid,radius}}}`
- `public/data/atlas-N.webp` — 1024-sprite atlases (96×96 each on a 3072×3072 sheet)

All produced by `python pipeline/build.py`. See `pipeline/README.md` for details.

## Public API

```tsx
import { MusicMap } from "@/components/music-map";

<MusicMap />
```

The component takes no props in v1. It owns its own canvas, state (via Zustand
under the hood), and overlays (tooltip, slider, search). The parent just needs
to give it a sized container — fullscreen is recommended but it works in any
aspect ratio.

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

## State machine

```
loading  ──data fetched──▶  idle  ──cursor move──▶  interactive
                            ↑                          │
                            │                          ↓ (5s no input)
                            └─────────focus(null)───── focus  ◀──album click──
                                                       │
                                                       ↓
                                                  tooltip + slider visible
```

## Performance budget

| Metric | Target | Where measured |
|---|---|---|
| First paint | < 1s | LCP |
| Map interactive | < 2.5s | data + atlas-0 fetched |
| Idle / pan | 60fps | useFrame |
| Slider tween | ≥45fps | useFrame |
| GPU memory | < 80MB | devtools → Memory |

## Visual references

- `docs/superpowers/visual-references/aged-paper-map.html`
- `docs/superpowers/visual-references/blend-zoom.html`

## File layout

```
src/components/music-map/
├── MusicMap.tsx           # top-level: canvas + overlays + bootstrap
├── canvas/
│   ├── Scene.tsx          # R3F scene root
│   ├── AlbumField.tsx     # the 5k-album InstancedMesh (hot path)
│   ├── RegionWashes.tsx   # watercolor color washes
│   ├── RegionLabels.tsx   # italic-serif cluster labels
│   ├── BackgroundLayer.tsx
│   ├── CameraRig.tsx      # pan + zoom
│   ├── CursorTracker.tsx  # cursor → world coords
│   ├── FocusController.tsx
│   ├── FlyToFocus.tsx     # camera animation on focus
│   ├── AmbientDrift.tsx   # idle Perlin drift
│   ├── AtlasManager.tsx   # lazy atlas loading
│   └── ProjectionBridge.tsx  # world → screen events for DOM overlays
├── overlays/
│   ├── Tooltip.tsx
│   ├── Slider.tsx
│   ├── SearchOverlay.tsx
│   ├── LoadingState.tsx
│   └── MobileFallback.tsx
├── state/
│   ├── store.ts           # Zustand store
│   └── projection.ts      # interpolation + KNN + easing
├── data/
│   ├── loader.ts
│   └── types.ts
└── shaders/
    ├── album.ts           # vertex + fragment for the album field
    └── wash.ts            # fragment for region washes
```

## Future paths

- WebGPU live projection (approach C from brainstorming)
- Spotify OAuth → project visitor's library into our map
- Spotify preview audio on focus
- Auto-refresh GitHub Action (weekly cron over the dataset)

See `docs/superpowers/specs/2026-05-12-music-map-design.md` for the full design rationale.
