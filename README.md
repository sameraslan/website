# samer aslan — personal site

Source for [sameraslan.com](https://sameraslan.com). Next.js 16 + Tailwind 4 + MDX, statically rendered, deployed on Vercel.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styles:** Tailwind 4 with custom theme tokens (see `tailwind.config.ts`)
- **Type:** Fraunces (serif) + JetBrains Mono via `next/font/google`
- **Content:** MDX via `next-mdx-remote/rsc` + `gray-matter` for frontmatter
- **Tests:** Vitest + Testing Library
- **Hosting:** Vercel

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Other scripts:

```bash
npm run build   # production build
npm run start   # serve production build
npm run lint    # ESLint (next/core-web-vitals)
npm test        # Vitest run
```

## Repo structure

```
src/
  app/                   route segments (App Router)
  components/
    layout/              Sidebar, MobileNav, PageShell
    music-map/           MusicMap (placeholder), Caption, Hero
    content/             ProjectCard, ResearchCard, AboutHeader, CrossLinkCard
  content/
    projects/*.mdx       project entries
    research/*.mdx       research entries
  lib/
    site-config.ts       name, nav items, external links
    content.ts           MDX loader + frontmatter parsing
    music-data.ts        listening.json loader
    fonts.ts             next/font wiring
public/
  data/listening.json    music-map data (also used by the parallel viz session)
  data/covers/           album cover thumbnails
  images/avatar.jpg      profile photo
```

## Adding content

See [`docs/content-authoring.md`](docs/content-authoring.md) for how to add a project, add research, or update `/about`, `/now`, `/misc`.

## Music map integration

The music visualization (`src/components/music-map/MusicMap.tsx`) is the integration point for a separately-built viz. The current implementation is a placeholder SVG. The component contract is:

```ts
interface MusicMapProps {
  className?: string;
  width: number;
  height: number;
  data?: AlbumPoint[];
  interactive?: boolean;
  onHoverAlbum?: (album: AlbumPoint | null) => void;
  onClickAlbum?: (album: AlbumPoint) => void;
}
```

Swap the placeholder by replacing the file. Data comes from `public/data/listening.json`. Detailed contract in [`docs/architecture.md`](docs/architecture.md).

## Deployment

Pushes to the deployment branch deploy via Vercel. Preview deployments are created for every PR. No env vars required at launch.

## License

MIT — see `LICENSE`.
