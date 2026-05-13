# Personal Website Redesign — Design Spec

**Date:** 2026-05-12
**Owner:** Samer Aslan
**Status:** Approved, ready for implementation plan
**Replaces:** Current "Once UI Magic Portfolio" template-based site

---

## 1. Concept

A quiet, scientific-feeling personal site inspired by Boran Wang's restraint (boranw.com). Cream paper, sage green accent, serif type. The hero of the homepage is a real visualization — an album proximity map of Samer's listening — not decoration. Everything else is sparse, on purpose.

The site signals "engineer + researcher who takes craft seriously" without ever saying so. Identity-forward over corporate. The science is the design, and the science happens to be Samer's music taste.

**Not** corporate portfolio, digital garden, 3D experience, dark mode, or a generic Tailwind UI starter.

## 2. Visual system

### Color tokens

| Token | Hex | Use |
|---|---|---|
| `paper` | `#f6f0e1` | Page background. Warm linen cream. |
| `ink` | `#2d2a22` | Primary text. Soft black. |
| `ink-muted` | `#6b6852` | Secondary text, captions. |
| `ink-dim` | `#b3ab94` | Tertiary text, inactive nav, dim labels. |
| `sage` | `#5b7855` | Accent: name, active nav, links, focus rings. |
| `sage-deep` | `#3e5a3a` | Hover state on sage. |
| `paper-soft` | `#fbf6e6` | Subtle differentiator for cards / code blocks. |
| `rule` | `#d8d0bd` | Hairline dividers. |

One accent (sage). The music-map viz brings its own muted, data-driven palette (see §5).

### Typography

- **Serif:** Fraunces (variable, optical sizing). Nav, headings, body.
- **Mono:** JetBrains Mono. Code, data captions, technical labels — sparingly.
- Fonts loaded via `next/font/google` (self-hosted, no FOUT).
- Lowercase in nav and section labels. Sentence case in body. No `text-transform: uppercase`.

### Type scale (rem, 16px base)

| Step | rem |
|---|---|
| h1 | 2.5 |
| h2 | 1.75 |
| h3 | 1.25 |
| body | 1.0625 |
| small | 0.875 |
| tiny | 0.75 |

### Spacing & motion

- Tailwind default spacing scale.
- Sidebar width 180px (desktop), main padding 64px L/R, page padding 56px top / 32px bottom.
- Generous whitespace; prose max-width 640–680px.
- Motion is minimal: hover transitions ≤200ms, fade-in on first nav. No parallax, no scroll-jacking, no shimmer.

## 3. Information architecture

### Sitemap

```
/                  homepage — album proximity map (full canvas)
/about             photo + intro + bio
/projects          personal projects (cards)
/projects/[slug]   MDX project detail page
/research          academic research (cards)
/research/[slug]   MDX research detail page
/music             deeper page about the album map
/misc              non-tech interests
/now               current activities ("now" page)
```

Sidebar external links (not pages): `email`, `github`, `linkedin`.

### Page-level outlines

- **`/` Homepage** — Sidebar nav left; album proximity map fills the rest of the canvas. Caption below: *"a map of my listening — proximity by sound, color by mood"*. No text intro, no scroll.

- **`/about`** — Photo (~280px square), 2–3 sentence intro alongside, then compact bio. Languages, location. Starting draft of intro copy (refine later):
  > *I'm passionate about blending cutting-edge AI and machine learning research with engineering to develop innovative solutions that create meaningful and positive experiences for people. My non-tech interests include human psychology and behavior, the brain and its role in sensation and perception, art (especially music and its influence on cognition), and the intersection of nutrition and human well-being. I'm always open to speaking with others who share similar interests or are working on related projects — feel free to reach out.*

- **`/projects`** — List of personal projects (each: title, one-line description, year, tech stack chips, hero image, link to detail). Initial entries:
  - **RecMyRecord** — Mood and Audio-Based Album Recommender for Cross-Genre Discovery — https://www.recmyrecord.com
  - **BinSight** — Lightweight, vision-based waste sorting system — https://github.com/sameraslan/BinSight
  - Bloomberg projects deferred (proprietary; Samer will add when shareable).

- **`/projects/[slug]`** — MDX. Title, year, role, stack, links, long-form writeup.

- **`/research`** — Same shape as `/projects`. Initial entries:
  - **DiaLong** — Benchmarking Reminiscence in Long Context Dialogues — JHU CLSP — https://github.com/sameraslan/DiaLong
  - **PerceptAlign** — Real-Time Temporal Alignment for Audio Generation from Silent Videos — JHU Dynamic Perception Lab — https://github.com/sameraslan/PerceptAlign

- **`/research/[slug]`** — MDX. Title, lab, year, collaborators, abstract, writeup, paper/code links.

- **`/music`** — Short essay on how the album map is built (data source, embedding method, what clusters mean). Below: top albums, listening logs, cross-link card to **RecMyRecord**.

- **`/misc`** — Catch-all for non-tech interests: books, brain/cognition, nutrition, links. Light sections within.

- **`/now`** — 2–3 short paragraphs ("currently working at X, reading Y, listening to Z"). Footer line with last-updated date. Updated occasionally.

### Content model

- MDX for `/projects/*` and `/research/*` detail pages.
- TSX components with inline content for `/about`, `/now`, `/misc`, `/music`.

## 4. Layout system

### Desktop (≥1024px)

Two-column. Sidebar fixed 180px wide, sticky on scroll, vertically anchored toward top. Main column fluid, with per-page max-width.

| Page | Main column |
|---|---|
| `/` | Full-bleed, no max-width. Music map fills available space. |
| `/about`, `/now`, `/misc` | Text-led, `max-width: 640px`. |
| `/projects`, `/research` | List/grid, `max-width: 800px`. |
| `/projects/[slug]`, `/research/[slug]` | MDX prose, `max-width: 680px`. |
| `/music` | Mixed — prose at 680px, full-width data sections below. |

### Tablet (768–1023px)

Same 2-column. Sidebar 140px, outer padding 32px.

### Mobile (<768px)

Sidebar collapses to top text-nav. No hamburger. `samer aslan` first (larger, name-as-title), then `about · projects · research · music · misc · now` on one row. Sidebar external links live at the bottom of the page. Music map gets a touch-friendly rendering (panning enabled).

### Active state

Active nav item is `sage`. All others `ink`. External sidebar links always `ink`.

## 5. Music-map integration

The music visualization is built in a parallel session. The site treats it as a black-box component plugged into a stable slot.

### Component contract

```ts
// src/components/music-map/MusicMap.tsx
export interface MusicMapProps {
  className?: string;
  width: number;          // pixels — parent measures and passes down
  height: number;
  data?: AlbumPoint[];    // optional; defaults to baked-in fixture
  interactive?: boolean;  // default true on desktop, false on mobile
  onHoverAlbum?: (album: AlbumPoint | null) => void;
  onClickAlbum?: (album: AlbumPoint) => void;
}

export interface AlbumPoint {
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

Schema treated as a starting placeholder; the parallel session may revise.

### Data source

- `public/data/listening.json` — albums + positions + clusters.
- `public/data/covers/` — small square cover thumbnails (or CDN URLs).
- The same data file feeds both the homepage hero and `/music`.

### Where used

1. `/` homepage — full-canvas, interactive.
2. `/music` — embedded smaller, with surrounding copy + RecMyRecord cross-link.

### Fallbacks

- Missing/malformed `listening.json` → small placeholder text: *"map is regenerating, check back soon"*. No app-breaking errors.
- SSR strategy left to the viz author. The site supports either static SSR or `dynamic({ ssr: false })` if `window` is needed.

### Caption strip

Rendered by the site (not the component) so copy can change without touching viz internals. Default copy in §3.

### Viz palette (for the parallel session)

Recommended muted, earthy palette for clustering (all sit well on `paper`):

| Token | Hex | Suggested cluster meaning |
|---|---|---|
| sage | `#5b7855` | green / calm / ambient |
| olive | `#7c8255` | folk / acoustic |
| forest | `#3a6655` | electronic / textured |
| oxblood | `#8a3a2a` | rock / aggressive |
| terracotta | `#b6532a` | warm / soul / r&b |
| amber | `#a8945c` | jazz / classical |
| slate | `#5a7080` | drone / cold |
| plum | `#6a4860` | introspective / lyrical |

Avoid neon, saturated primaries, pure white, pure black.

## 6. Tech stack & repo

### Stack

- **Next.js 16** (App Router), TypeScript, static rendering.
- **Tailwind CSS** with theme tokens (`bg-paper`, `text-ink`, `text-sage`, etc.) configured in `tailwind.config.ts`.
- **shadcn/ui** used minimally: likely `Card`, `Badge`, `Separator`.
- **MDX** for project/research detail pages (`@next/mdx` or `next-mdx-remote`).
- **next/font/google** for Fraunces and JetBrains Mono.
- **Vercel** deployment (existing).

### Migration strategy

**Nuke and start fresh.** Delete the existing `/src` and `/src/once-ui` entirely. Reset `package.json` to a minimal Next.js + Tailwind + shadcn setup. Preserve any reusable assets in `/public/images/` (e.g., avatar) intentionally.

### Repo structure

```
src/
  app/
    layout.tsx               # root layout: sidebar + main slot
    page.tsx                 # / — music map hero
    about/page.tsx
    projects/page.tsx
    projects/[slug]/page.tsx
    research/page.tsx
    research/[slug]/page.tsx
    music/page.tsx
    misc/page.tsx
    now/page.tsx
    not-found.tsx
  components/
    layout/Sidebar.tsx
    layout/PageShell.tsx
    music-map/MusicMap.tsx        # placeholder until parallel session ships
    music-map/MusicMapCaption.tsx
    content/
      ProjectCard.tsx
      ResearchCard.tsx
      AboutHeader.tsx
  content/
    projects/recmyrecord.mdx
    projects/binsight.mdx
    research/dialong.mdx
    research/perceptalign.mdx
  lib/
    content.ts
    music-data.ts
  styles/
    globals.css
public/
  images/
  data/listening.json
  data/covers/
package.json
tailwind.config.ts
tsconfig.json
next.config.mjs
```

### MDX frontmatter (projects + research)

```yaml
---
title: "DiaLong"
subtitle: "Benchmarking Reminiscence in Long Context Dialogues"
year: 2024
role: "Researcher"
affiliation: "JHU CLSP"          # research only
stack: ["Python", "PyTorch", "HuggingFace"]
links:
  github: "https://github.com/sameraslan/DiaLong"
  paper: ""
  demo: ""
heroImage: "/images/projects/dialong-hero.png"
order: 1
---
```

## 7. Out of scope

- Blog / `/writings` page (deferred).
- Search.
- Dark mode.
- i18n / localization.
- Newsletter signup.
- Analytics beyond Vercel defaults.
- CMS — all content lives in the repo.
- Live "currently playing" Spotify integration (potential follow-up).

## 8. Verification plan

When implementing, verify by:

1. Visual diff against approved mockups (the "Sage on Linen" theme).
2. Manual walk-through of each route: renders, sidebar active state correct, mobile nav stacks correctly.
3. Music-map placeholder renders with reasonable fixture data; swap-in path documented for parallel session.
4. MDX project + research detail pages render with frontmatter pulled correctly.
5. Lighthouse audit on `/` (target: Performance ≥ 90, Accessibility ≥ 95).
6. Production deploy on Vercel preview.

## 9. Open questions / refinements deferred to implementation

- Exact Fraunces optical-sizing settings per heading.
- Whether sidebar should fade in subtly or appear instantly.
- Caption strip live-data integration (currently static).
- Exact `MusicMap` schema may shift once the parallel session stabilizes — treat as a draft contract.
- About-page copy is a starting draft; will be refined post-implementation.
