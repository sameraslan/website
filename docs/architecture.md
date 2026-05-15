# Architecture

This document describes how the site is put together — what each piece is responsible for and how the pieces connect.

## Routing & layout

Single layout shell in `src/app/layout.tsx`. It wires:

1. Google fonts (Fraunces, JetBrains Mono) via `src/lib/fonts.ts`.
2. Desktop `<Sidebar/>` (hidden below 768px).
3. Mobile `<MobileNav/>` (shown below 768px) — rendered inside `<main>` above page content.
4. The `<main>` slot that contains the route.

Every route is its own folder under `src/app/`. The App Router resolves them by file name; `page.tsx` is the route, `not-found.tsx` is the 404. Pages are React Server Components by default; only components that need interactivity (`Sidebar`, `MobileNav`, `MusicMapHero`) are marked `'use client'`.

## Page widths

Different routes want different reading widths. `<PageShell>` (in `src/components/layout/PageShell.tsx`) sets one of four max-widths:

| Width   | Used for                          | Tailwind class      |
|---------|-----------------------------------|---------------------|
| `full`  | `/` homepage                      | (no max-width)      |
| `text`  | `/about`, `/now`, `/misc`         | `max-w-text` (640px) |
| `list`  | `/projects`, `/research`          | `max-w-list` (800px) |
| `prose` | MDX detail pages, `/music`        | `max-w-prose` (680px) |

Each page imports `<PageShell width="...">` and wraps its content.

## Styling

Tailwind 4 with CSS-first theme tokens. The palette and font tokens live in two places:

1. **`src/app/globals.css`** — `@theme { --color-paper: ... }` declarations that Tailwind 4 reads to generate color utilities (`bg-paper`, `text-ink`, etc).
2. **`tailwind.config.ts`** — extends Tailwind's defaults with the same colors (for legacy plugins/IDE completion), font families, type scale, and three named max-widths.

Type scale: `text-tiny`, `text-small`, `text-body`, `text-h3`, `text-h2`, `text-h1` mapped per spec §2.

Prose styles for MDX bodies live in `globals.css` as `.prose-mdx` — a small layer so MDX content doesn't need per-component styling.

## Content system

Two channels:

1. **TSX with inline content** — `/about`, `/now`, `/misc`, `/music`, `/`. Copy lives in the route file. Quick to edit, no schema.
2. **MDX** — `/projects/[slug]`, `/research/[slug]`. Each entry is an `.mdx` file under `src/content/{projects,research}/` with YAML frontmatter and Markdown body.

### The content loader

`src/lib/content.ts` exposes two functions:

- `loadEntries(folder: 'projects' | 'research'): Promise<Entry[]>` — reads every `.mdx` file in the folder, parses frontmatter via `gray-matter`, returns entries sorted by `order` ascending then `year` descending. Files without a valid frontmatter block (no `title`) are silently skipped so a malformed draft can't crash the build.
- `loadEntry(folder, slug): Promise<Entry>` — loads a single entry by slug. Throws if missing or if frontmatter is invalid.

Both are async and read from disk at build time. List and detail pages use `loadEntries`/`loadEntry` from React Server Components. Detail routes call `generateStaticParams()` so every entry is pre-rendered.

### Frontmatter schema

```yaml
---
title:       string          # required
subtitle:    string?
year:        number?
role:        string?
affiliation: string?         # research only
stack:       string[]?
links:
  github: string?
  paper:  string?
  demo:   string?
  site:   string?
heroImage:   string?         # path under /public/images/
order:       number?         # lower = earlier in list
---
```

All fields are optional except `title`. Cards and detail headers render conditionally on what's present.

## Music-map integration

The music map is the visual centerpiece of the site, but the actual visualization is built in a parallel session. The site treats it as a black-box component plugged into a stable slot.

### Component contract

`src/components/music-map/MusicMap.tsx` exports `MusicMap` and the `AlbumPoint` type. The props contract is fixed:

```ts
interface MusicMapProps {
  className?: string;
  width: number;          // pixels — parent measures and passes down
  height: number;
  data?: AlbumPoint[];    // optional; defaults to baked-in fixture
  interactive?: boolean;  // default true on desktop, false on mobile
  onHoverAlbum?: (album: AlbumPoint | null) => void;
  onClickAlbum?: (album: AlbumPoint) => void;
}

interface AlbumPoint {
  id: string;
  title: string;
  artist: string;
  year?: number;
  coverUrl: string;
  x: number;     // normalized 0–1
  y: number;     // normalized 0–1
  cluster?: string;
  size?: number;
}
```

The current implementation is a placeholder: a static SVG of colored circles labeled with album titles, positioned by normalized `(x, y)`. Replace by editing this single file — anywhere consuming `<MusicMap/>` keeps working.

### Where it plugs in

- **`/` homepage** — Wrapped in `<MusicMapHero>` (client component, measures available space with `ResizeObserver`, passes pixel dimensions to `MusicMap`). Full canvas.
- **`/music`** — Embedded at fixed 680×420.

### Data

`public/data/listening.json` is the single source of truth. Schema matches `AlbumPoint[]`. The loader (`src/lib/music-data.ts`) handles missing/malformed data by returning an empty array, which the placeholder renders as *"map is regenerating, check back soon"*.

### Caption strip

`<MusicMapCaption text="..." />` is rendered by the route, not the component, so copy is easy to change without touching viz internals. The homepage tagline lives in `src/lib/site-config.ts`.

### When the real viz lands

The parallel session can either:

1. Replace `MusicMap.tsx` in place — preserving the prop interface.
2. Add the new implementation as `MusicMapInteractive.tsx` and swap imports in `MusicMapHero.tsx` and `src/app/music/page.tsx`.

If the new viz needs `window` (e.g., uses `d3`, WebGL, canvas), wrap it in `next/dynamic({ ssr: false })`.

## Mobile behavior

The breakpoint is 768px (Tailwind `md:`).

- Below 768px the sidebar hides and the mobile top-nav appears in the main column, with the name as a large heading and nav items separated by `·`.
- External links (`email · github · linkedin`) appear at the bottom of every page, above a top border — rendered by `<PageShell>` via `<MobileExternalLinks/>`.
- The music map shrinks to fit width. Interactivity (panning/zoom) is the viz author's call — props let the page pass `interactive={false}` on mobile if needed.

## Build & deploy

Statically rendered. `next build` produces static HTML for every route including `/projects/[slug]` and `/research/[slug]` (via `generateStaticParams`). Vercel deploys main on push; preview deployments per PR.

No environment variables required at launch.
