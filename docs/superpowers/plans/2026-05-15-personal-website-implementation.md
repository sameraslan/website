# Personal Website Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-12-personal-website-design.md`](../specs/2026-05-12-personal-website-design.md)
**Approved mockups:** [`docs/superpowers/specs/mockups/`](../specs/mockups/) — `2026-05-12-sage-on-linen.html` (theme) and `2026-05-12-boran-inspiration.html` (hero layout).

**Goal:** Replace the existing Once UI Magic Portfolio template with a quiet, sage-on-linen personal site whose hero is an album-proximity music map. Ship it on Vercel with proper documentation.

**Architecture:** Next.js 16 App Router, statically rendered. A two-column layout shell (sidebar + main) wraps every page. Content is hybrid: TSX for `/about`, `/now`, `/misc`, `/music`, homepage; MDX (frontmatter + body) for `/projects/[slug]` and `/research/[slug]`, with a small loader in `src/lib/content.ts`. The music map is a black-box component (`src/components/music-map/MusicMap.tsx`) with a stable props contract; its real implementation arrives later from a parallel session. We ship a placeholder that renders a viewport-filling SVG of the fixture data so the homepage never looks broken.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `next/font/google` (Fraunces, JetBrains Mono), `next-mdx-remote/rsc` + `gray-matter` for MDX, shadcn/ui (minimal, only if needed), Vercel for deploy. Package manager: npm (existing repo uses `package-lock.json`).

**Working tree:** This worktree is on branch `worktree-new_ui`. All work happens here. Do not `cd` to the original repo root.

---

## File Structure

The plan creates the following files. Each has a single clear responsibility.

### Configuration & setup
- `package.json` — fresh, minimal dependencies (Next 16, React 19, Tailwind 4, MDX deps, dev tooling)
- `tsconfig.json` — Next.js + TS strict mode + `@/*` path alias to `src/*`
- `next.config.mjs` — MDX page extensions, image domains if needed
- `tailwind.config.ts` — theme tokens (colors, fonts, type scale, spacing extensions)
- `postcss.config.js` — Tailwind + autoprefixer
- `.eslintrc.json` — next/core-web-vitals + TS
- `.env.example` — placeholder (no required env vars at launch)

### Styles
- `src/app/globals.css` — Tailwind directives, base resets, font-family wiring, ::selection, focus-ring

### App Router pages
- `src/app/layout.tsx` — root HTML, font wiring, `<Sidebar/>` + main slot
- `src/app/page.tsx` — homepage (full-canvas music map + caption)
- `src/app/about/page.tsx`
- `src/app/projects/page.tsx`
- `src/app/projects/[slug]/page.tsx`
- `src/app/research/page.tsx`
- `src/app/research/[slug]/page.tsx`
- `src/app/music/page.tsx`
- `src/app/misc/page.tsx`
- `src/app/now/page.tsx`
- `src/app/not-found.tsx`

### Components
- `src/components/layout/Sidebar.tsx` — desktop sidebar (nav + external links)
- `src/components/layout/MobileNav.tsx` — mobile top-nav variant
- `src/components/layout/PageShell.tsx` — per-page wrapper that sets max-width per route
- `src/components/music-map/MusicMap.tsx` — placeholder viz (real impl arrives later)
- `src/components/music-map/MusicMapCaption.tsx` — caption strip
- `src/components/content/ProjectCard.tsx` — used on `/projects`
- `src/components/content/ResearchCard.tsx` — used on `/research`
- `src/components/content/AboutHeader.tsx` — photo + intro block on `/about`
- `src/components/content/CrossLinkCard.tsx` — used on `/music` to link RecMyRecord

### Lib
- `src/lib/site-config.ts` — name, nav items, external links, RSS-style "now" metadata
- `src/lib/content.ts` — MDX content loader (read .mdx, parse frontmatter, sort)
- `src/lib/music-data.ts` — listening.json loader + fallback handling
- `src/lib/content.test.ts` — unit tests for the loader

### Content
- `src/content/projects/recmyrecord.mdx`
- `src/content/projects/binsight.mdx`
- `src/content/research/dialong.mdx`
- `src/content/research/perceptalign.mdx`

### Data & assets
- `public/data/listening.json` — fixture (~16 albums)
- `public/data/covers/.gitkeep` — placeholder until real covers land
- `public/images/avatar.jpg` — **PRESERVED** from existing repo
- (existing template demo images under `public/images/` are deleted)

### Documentation (deliverable per spec §6)
- `README.md` — top-level: stack, run, deploy, content, music-map slot
- `docs/architecture.md` — how everything fits together
- `docs/content-authoring.md` — how to add a project/research entry

---

## Conventions for every task

- Run commands from this worktree directory (`/Users/saslan.19/Desktop/Tengs/codingMiscellaneous/website/.claude/worktrees/new_ui`).
- After each task's final step, commit with the message shown. Keep commits small and topical.
- When a step says "verify in browser," run `npm run dev` in a separate terminal (started in Task 2) and open the URL. If the dev server is already running, just refresh.
- Tasks 1–4 must run sequentially. Tasks 7–10 and 18–20 can be reordered if convenient. The MDX tasks (11–17) depend on the loader (Task 11) being done first.

---

## Task 1: Wipe the slate while preserving what we keep

**Files:**
- Delete: `src/`, `package.json`, `package-lock.json`, `biome.json`, `next.config.mjs`, `postcss.config.js`, `tsconfig.json`, `.env.example`, `.eslintrc.json`, `README.md`, `public/images/gallery/`, `public/images/og/`, `public/images/projects/`, `public/images/trademark/`, `public/fonts/`, `node_modules/` (if present)
- Preserve: `.git/`, `.gitignore`, `.github/`, `LICENSE`, `docs/`, `.superpowers/`, `public/images/avatar.jpg`

- [ ] **Step 1: Confirm the avatar exists before nuking the rest**

Run:
```bash
test -f public/images/avatar.jpg && echo "avatar OK" || echo "avatar MISSING — STOP"
```
Expected: `avatar OK`. If missing, stop and ask the user.

- [ ] **Step 2: Stage the avatar in a safe location**

Run:
```bash
mkdir -p /tmp/website-preserve && cp public/images/avatar.jpg /tmp/website-preserve/avatar.jpg
```

- [ ] **Step 3: Delete template files and demo assets**

Run:
```bash
rm -rf src node_modules public/images public/fonts
rm -f package.json package-lock.json biome.json next.config.mjs postcss.config.js tsconfig.json .env.example .eslintrc.json README.md
```

- [ ] **Step 4: Restore the avatar**

Run:
```bash
mkdir -p public/images && mv /tmp/website-preserve/avatar.jpg public/images/avatar.jpg
```

- [ ] **Step 5: Verify only the expected files remain**

Run:
```bash
ls -A1 | sort
```
Expected output (exact set):
```
.git
.github
.gitignore
.superpowers
LICENSE
docs
public
```

Then:
```bash
ls public/images
```
Expected: `avatar.jpg` (and nothing else).

- [ ] **Step 6: Commit the wipe**

```bash
git add -A
git commit -m "chore: wipe Once UI Magic Portfolio template (preserve avatar)"
```

---

## Task 2: Bootstrap fresh Next.js 16 + TypeScript + Tailwind 4

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `.eslintrc.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Initialize a fresh Next.js project in place**

`create-next-app` refuses non-empty directories, so we install bare and write configs ourselves.

Run:
```bash
npm init -y
```

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
npm install next@^16 react@^19 react-dom@^19 next-mdx-remote@^5 gray-matter@^4 clsx@^2
```

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss@^4 @tailwindcss/postcss postcss autoprefixer eslint eslint-config-next vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Edit `package.json` to add scripts**

The npm installs in Steps 2–3 already populated `dependencies` and `devDependencies`. Open `package.json` and:

1. Add `"private": true` at the top level.
2. Replace the `scripts` block (currently `{ "test": "echo ...exit 1" }`) with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

Leave the installer's pinned versions for `dependencies` and `devDependencies` as-is.

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create `next.config.mjs`**

We render MDX dynamically via `next-mdx-remote/rsc` (load `.mdx` files as strings, parse frontmatter with `gray-matter`, render in RSC). We do *not* want Next to treat `.mdx` files as routes, so we don't use `@next/mdx`.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 7: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 8: Create `.eslintrc.json`**

```json
{ "extends": "next/core-web-vitals" }
```

- [ ] **Step 9: Stub `src/app/globals.css` so the dev server boots**

```css
@import "tailwindcss";

@layer base {
  html, body { background: #f6f0e1; color: #2d2a22; }
}
```

- [ ] **Step 10: Stub `src/app/layout.tsx`**

```tsx
import './globals.css';

export const metadata = { title: 'samer aslan', description: 'personal site' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 11: Stub `src/app/page.tsx`**

```tsx
export default function Home() {
  return <main className="p-16">hello, samer</main>;
}
```

- [ ] **Step 12: Verify the dev server boots**

Run in one terminal:
```bash
npm run dev
```
Open http://localhost:3000. Expected: cream page with "hello, samer" in black. No console errors. **Leave this dev server running for the rest of the plan.**

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: bootstrap fresh Next.js 16 + Tailwind 4 + TS"
```

---

## Task 3: Wire up the visual system (colors, fonts, type scale)

**Files:**
- Create: `tailwind.config.ts`, `src/lib/fonts.ts`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1: Create `tailwind.config.ts` with the spec's theme tokens**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f6f0e1',
        'paper-soft': '#fbf6e6',
        ink: '#2d2a22',
        'ink-muted': '#6b6852',
        'ink-dim': '#b3ab94',
        sage: '#5b7855',
        'sage-deep': '#3e5a3a',
        rule: '#d8d0bd',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        tiny: ['0.75rem',   { lineHeight: '1.4' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        body: ['1.0625rem', { lineHeight: '1.6' }],
        h3: ['1.25rem',     { lineHeight: '1.4' }],
        h2: ['1.75rem',     { lineHeight: '1.3' }],
        h1: ['2.5rem',      { lineHeight: '1.2' }],
      },
      maxWidth: {
        prose: '680px',
        text: '640px',
        list: '800px',
      },
      transitionDuration: { DEFAULT: '180ms' },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Create `src/lib/fonts.ts` for `next/font/google` wiring**

```ts
import { Fraunces, JetBrains_Mono } from 'next/font/google';

export const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});
```

- [ ] **Step 3: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-paper: #f6f0e1;
  --color-paper-soft: #fbf6e6;
  --color-ink: #2d2a22;
  --color-ink-muted: #6b6852;
  --color-ink-dim: #b3ab94;
  --color-sage: #5b7855;
  --color-sage-deep: #3e5a3a;
  --color-rule: #d8d0bd;
}

@layer base {
  html { -webkit-font-smoothing: antialiased; }
  body {
    background: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-fraunces), Georgia, serif;
    font-size: 1.0625rem;
    line-height: 1.6;
  }
  a { color: inherit; text-decoration: none; }
  a:hover { color: var(--color-sage-deep); }
  ::selection { background: var(--color-sage); color: var(--color-paper); }
  *:focus-visible { outline: 2px solid var(--color-sage); outline-offset: 2px; border-radius: 2px; }
  hr { border: 0; border-top: 1px solid var(--color-rule); }
}
```

- [ ] **Step 4: Wire fonts in `src/app/layout.tsx`**

```tsx
import './globals.css';
import { fraunces, jetbrainsMono } from '@/lib/fonts';

export const metadata = {
  title: 'samer aslan',
  description: 'personal site of samer aslan — engineer, researcher, listener.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Add a quick visual check on `/`**

Replace `src/app/page.tsx` with:
```tsx
export default function Home() {
  return (
    <main className="p-16 space-y-6">
      <h1 className="text-h1 font-serif text-ink">samer aslan</h1>
      <p className="text-body text-ink-muted max-w-text">
        type test — the body should be Fraunces, this paragraph should be muted ink on linen paper.
      </p>
      <p className="text-small font-mono text-sage">mono / sage / small — JetBrains Mono.</p>
    </main>
  );
}
```

- [ ] **Step 6: Verify in browser**

Refresh http://localhost:3000. Expected:
- Background is warm cream (`#f6f0e1`).
- Heading is Fraunces serif, dark ink.
- Body paragraph is Fraunces serif, slightly muted.
- Mono line is JetBrains Mono in sage green.
- No FOUT (font swap should be invisible).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(theme): wire sage-on-linen palette, Fraunces + JetBrains Mono, type scale"
```

---

## Task 4: Site config (nav items + external links)

**Files:**
- Create: `src/lib/site-config.ts`

- [ ] **Step 1: Create `src/lib/site-config.ts`**

```ts
export type NavItem = { label: string; href: string };

export const siteConfig = {
  name: 'samer aslan',
  tagline: 'a map of my listening — proximity by sound, color by mood',
  meta: {
    title: 'samer aslan',
    description: 'personal site of samer aslan — engineer, researcher, listener.',
  },
  nav: [
    { label: 'about',    href: '/about' },
    { label: 'projects', href: '/projects' },
    { label: 'research', href: '/research' },
    { label: 'music',    href: '/music' },
    { label: 'misc',     href: '/misc' },
    { label: 'now',      href: '/now' },
  ] as NavItem[],
  external: [
    { label: 'email',    href: 'mailto:samer.aslan.second@gmail.com' },
    { label: 'github',   href: 'https://github.com/sameraslan' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/sameraslan/' },
  ] as NavItem[],
};

export type SiteConfig = typeof siteConfig;
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(config): add siteConfig (nav + external links)"
```

---

## Task 5: Sidebar component (desktop)

**Files:**
- Create: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `src/components/layout/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { siteConfig } from '@/lib/site-config';

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="primary"
      className="hidden md:flex flex-col font-serif text-body leading-loose w-[180px] sticky top-14 self-start"
    >
      <Link
        href="/"
        className={clsx(
          'mb-5 font-medium',
          pathname === '/' ? 'text-sage' : 'text-ink hover:text-sage-deep'
        )}
      >
        {siteConfig.name}
      </Link>

      <ul className="space-y-0.5 mb-10">
        {siteConfig.nav.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={clsx(
                'transition-colors',
                isActive(item.href) ? 'text-sage' : 'text-ink hover:text-sage-deep'
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="space-y-0.5 text-small">
        {siteConfig.external.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
              className="text-ink hover:text-sage-deep transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-16 text-tiny text-ink-dim italic">
        © {new Date().getFullYear()}<br />samer aslan
      </p>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(layout): add desktop Sidebar with active-state highlighting"
```

---

## Task 6: Mobile top-nav variant

**Files:**
- Create: `src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Create `src/components/layout/MobileNav.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { siteConfig } from '@/lib/site-config';

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="primary mobile"
      className="md:hidden flex flex-col gap-3 mb-10"
    >
      <Link
        href="/"
        className={clsx(
          'font-serif text-h2',
          pathname === '/' ? 'text-sage' : 'text-ink'
        )}
      >
        {siteConfig.name}
      </Link>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-serif text-body">
        {siteConfig.nav.map((item, i) => (
          <li key={item.href} className="flex items-center gap-x-3">
            {i > 0 && <span aria-hidden className="text-ink-dim">·</span>}
            <Link
              href={item.href}
              className={isActive(item.href) ? 'text-sage' : 'text-ink hover:text-sage-deep'}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MobileExternalLinks() {
  return (
    <ul className="md:hidden flex flex-wrap gap-x-3 mt-16 pt-8 border-t border-rule text-small font-serif">
      {siteConfig.external.map((item, i) => (
        <li key={item.href} className="flex items-center gap-x-3">
          {i > 0 && <span aria-hidden className="text-ink-dim">·</span>}
          <a
            href={item.href}
            target={item.href.startsWith('http') ? '_blank' : undefined}
            rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
            className="text-ink hover:text-sage-deep"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(layout): add mobile top-nav + external links footer"
```

---

## Task 7: PageShell wrapper

**Files:**
- Create: `src/components/layout/PageShell.tsx`

- [ ] **Step 1: Create `src/components/layout/PageShell.tsx`**

```tsx
import clsx from 'clsx';
import { MobileExternalLinks } from './MobileNav';

type Width = 'full' | 'text' | 'list' | 'prose';

const widthClass: Record<Width, string> = {
  full: '',
  text: 'max-w-text',
  list: 'max-w-list',
  prose: 'max-w-prose',
};

export function PageShell({
  width = 'text',
  children,
}: {
  width?: Width;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className={clsx('w-full', widthClass[width])}>{children}</div>
      <MobileExternalLinks />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(layout): add PageShell with per-route max-widths"
```

---

## Task 8: Wire root layout (sidebar + main slot + 404)

**Files:**
- Create: `src/app/not-found.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update `src/app/layout.tsx`**

```tsx
import './globals.css';
import { fraunces, jetbrainsMono } from '@/lib/fonts';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { siteConfig } from '@/lib/site-config';

export const metadata = {
  title: siteConfig.meta.title,
  description: siteConfig.meta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <div className="min-h-screen px-8 md:px-16 pt-14 pb-8 md:flex md:gap-20">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <MobileNav />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `src/app/not-found.tsx`**

```tsx
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';

export default function NotFound() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 mb-4">not found</h1>
      <p className="text-ink-muted">
        no page at that path. <Link href="/" className="text-sage hover:text-sage-deep">go home</Link>.
      </p>
    </PageShell>
  );
}
```

- [ ] **Step 3: Verify in browser**

Refresh http://localhost:3000.
Expected:
- Sidebar on the left (≥768px viewport) with `samer aslan` in sage, then nav list in ink with current page in sage, then external links, then italic copyright at bottom.
- Resize browser to <768px: sidebar hides, mobile top-nav appears with name as large heading and nav items separated by `·`. External links appear at bottom inside a top-border.

Visit http://localhost:3000/this-does-not-exist. Expected: 404 page with sage "go home" link.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(layout): wire sidebar + main slot in root layout, add 404"
```

---

## Task 9: MusicMap placeholder component + fixture data

**Files:**
- Create: `src/components/music-map/MusicMap.tsx`, `src/components/music-map/MusicMapCaption.tsx`, `src/lib/music-data.ts`, `public/data/listening.json`, `public/data/covers/.gitkeep`

- [ ] **Step 1: Create the fixture `public/data/listening.json`**

```json
[
  { "id": "1", "title": "Avalon",                      "artist": "Roxy Music",     "year": 1982, "x": 0.18, "y": 0.32, "cluster": "amber",      "coverUrl": "" },
  { "id": "2", "title": "Selected Ambient Works",      "artist": "Aphex Twin",     "year": 1992, "x": 0.62, "y": 0.21, "cluster": "forest",     "coverUrl": "" },
  { "id": "3", "title": "Pink Moon",                   "artist": "Nick Drake",     "year": 1972, "x": 0.27, "y": 0.71, "cluster": "olive",      "coverUrl": "" },
  { "id": "4", "title": "Channel Orange",              "artist": "Frank Ocean",    "year": 2012, "x": 0.55, "y": 0.55, "cluster": "terracotta", "coverUrl": "" },
  { "id": "5", "title": "OK Computer",                 "artist": "Radiohead",      "year": 1997, "x": 0.71, "y": 0.42, "cluster": "slate",      "coverUrl": "" },
  { "id": "6", "title": "Kind of Blue",                "artist": "Miles Davis",    "year": 1959, "x": 0.38, "y": 0.28, "cluster": "amber",      "coverUrl": "" },
  { "id": "7", "title": "In Rainbows",                 "artist": "Radiohead",      "year": 2007, "x": 0.66, "y": 0.34, "cluster": "slate",      "coverUrl": "" },
  { "id": "8", "title": "To Pimp a Butterfly",         "artist": "Kendrick Lamar", "year": 2015, "x": 0.79, "y": 0.62, "cluster": "terracotta", "coverUrl": "" },
  { "id": "9", "title": "Discovery",                   "artist": "Daft Punk",      "year": 2001, "x": 0.82, "y": 0.28, "cluster": "forest",     "coverUrl": "" },
  { "id": "10","title": "For Emma, Forever Ago",       "artist": "Bon Iver",       "year": 2007, "x": 0.22, "y": 0.55, "cluster": "olive",      "coverUrl": "" },
  { "id": "11","title": "Sound of Silver",             "artist": "LCD Soundsystem","year": 2007, "x": 0.74, "y": 0.74, "cluster": "oxblood",    "coverUrl": "" },
  { "id": "12","title": "Funeral",                     "artist": "Arcade Fire",    "year": 2004, "x": 0.48, "y": 0.78, "cluster": "plum",       "coverUrl": "" },
  { "id": "13","title": "Currents",                    "artist": "Tame Impala",    "year": 2015, "x": 0.45, "y": 0.42, "cluster": "plum",       "coverUrl": "" },
  { "id": "14","title": "Songs in the Key of Life",    "artist": "Stevie Wonder",  "year": 1976, "x": 0.32, "y": 0.45, "cluster": "terracotta", "coverUrl": "" },
  { "id": "15","title": "Music for Airports",          "artist": "Brian Eno",      "year": 1978, "x": 0.51, "y": 0.18, "cluster": "sage",       "coverUrl": "" },
  { "id": "16","title": "The Köln Concert",            "artist": "Keith Jarrett",  "year": 1975, "x": 0.42, "y": 0.62, "cluster": "amber",      "coverUrl": "" }
]
```

- [ ] **Step 2: Create `public/data/covers/.gitkeep`**

Run:
```bash
mkdir -p public/data/covers && touch public/data/covers/.gitkeep
```

- [ ] **Step 3: Create `src/lib/music-data.ts`**

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface AlbumPoint {
  id: string;
  title: string;
  artist: string;
  year?: number;
  coverUrl: string;
  x: number;
  y: number;
  cluster?: string;
  size?: number;
}

export async function loadListening(): Promise<AlbumPoint[]> {
  try {
    const file = path.join(process.cwd(), 'public', 'data', 'listening.json');
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is AlbumPoint =>
        a && typeof a.id === 'string' && typeof a.x === 'number' && typeof a.y === 'number'
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Create `src/components/music-map/MusicMap.tsx` (placeholder viz)**

```tsx
import clsx from 'clsx';
import type { AlbumPoint } from '@/lib/music-data';

export interface MusicMapProps {
  className?: string;
  width: number;
  height: number;
  data?: AlbumPoint[];
  interactive?: boolean;
  onHoverAlbum?: (album: AlbumPoint | null) => void;
  onClickAlbum?: (album: AlbumPoint) => void;
}

export type { AlbumPoint };

const CLUSTER_COLORS: Record<string, string> = {
  sage:       '#5b7855',
  olive:      '#7c8255',
  forest:     '#3a6655',
  oxblood:    '#8a3a2a',
  terracotta: '#b6532a',
  amber:      '#a8945c',
  slate:      '#5a7080',
  plum:       '#6a4860',
};

export function MusicMap({ className, width, height, data = [] }: MusicMapProps) {
  if (data.length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center text-ink-dim italic text-small',
          className
        )}
        style={{ width, height }}
      >
        map is regenerating, check back soon
      </div>
    );
  }

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="album proximity map"
    >
      <rect width={width} height={height} fill="transparent" />
      {data.map((album) => {
        const cx = album.x * width;
        const cy = album.y * height;
        const r = album.size ?? 10;
        const fill = CLUSTER_COLORS[album.cluster ?? ''] ?? '#5b7855';
        return (
          <g key={album.id}>
            <circle cx={cx} cy={cy} r={r} fill={fill} opacity={0.85} />
            <text
              x={cx + r + 4}
              y={cy + 4}
              fontFamily="var(--font-fraunces), serif"
              fontSize={11}
              fill="#2d2a22"
            >
              {album.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Create `src/components/music-map/MusicMapCaption.tsx`**

```tsx
import clsx from 'clsx';

export function MusicMapCaption({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        'text-center text-small text-ink-muted italic mt-6',
        className
      )}
    >
      {text}
    </p>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(music-map): add placeholder viz, caption, listening.json fixture"
```

---

## Task 10: Homepage with music map hero

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/music-map/MusicMapHero.tsx`

- [ ] **Step 1: Create `src/components/music-map/MusicMapHero.tsx`**

The hero needs to measure available space so the SVG fills it. We do that client-side.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { MusicMap, type AlbumPoint } from './MusicMap';

export function MusicMapHero({ data }: { data: AlbumPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full" style={{ height: 'min(70vh, 640px)' }}>
      {size.w > 0 && size.h > 0 && (
        <MusicMap width={size.w} height={size.h} data={data} interactive />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import { loadListening } from '@/lib/music-data';
import { MusicMapHero } from '@/components/music-map/MusicMapHero';
import { MusicMapCaption } from '@/components/music-map/MusicMapCaption';
import { siteConfig } from '@/lib/site-config';

export default async function Home() {
  const data = await loadListening();
  return (
    <section className="w-full">
      <MusicMapHero data={data} />
      <MusicMapCaption text={siteConfig.tagline} />
    </section>
  );
}
```

- [ ] **Step 3: Verify in browser**

Refresh http://localhost:3000.
Expected: sidebar on the left, music map fills the rest with ~16 colored circles labeled with album titles, caption below in muted italic. No scroll on a standard desktop viewport.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): render music-map hero with caption"
```

---

## Task 11: MDX content loader (TDD)

**Files:**
- Create: `src/lib/content.ts`, `src/lib/content.test.ts`, `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write failing test `src/lib/content.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadEntries, loadEntry, type Entry } from './content';

const FIXTURE_DIR = path.join(process.cwd(), 'src', 'content', '__test__');

const ALPHA = `---
title: "Alpha"
subtitle: "First entry"
year: 2024
role: "Author"
stack: ["TypeScript"]
links: { github: "https://example.com/alpha" }
order: 2
---

Body of alpha.
`;

const BETA = `---
title: "Beta"
subtitle: "Second entry"
year: 2023
role: "Author"
stack: ["Python"]
order: 1
---

Body of beta.
`;

const NO_FRONTMATTER = `Just a body, no frontmatter.`;

beforeAll(async () => {
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURE_DIR, 'alpha.mdx'), ALPHA);
  await fs.writeFile(path.join(FIXTURE_DIR, 'beta.mdx'),  BETA);
  await fs.writeFile(path.join(FIXTURE_DIR, 'bad.mdx'),   NO_FRONTMATTER);
});

afterAll(async () => {
  await fs.rm(FIXTURE_DIR, { recursive: true, force: true });
});

describe('content loader', () => {
  it('loads entries from a directory', async () => {
    const entries = await loadEntries('__test__');
    expect(entries.map((e: Entry) => e.slug).sort()).toEqual(['alpha', 'beta']);
  });

  it('sorts by order ascending, then year descending', async () => {
    const entries = await loadEntries('__test__');
    expect(entries.map((e) => e.slug)).toEqual(['beta', 'alpha']);
  });

  it('parses frontmatter into typed fields', async () => {
    const beta = await loadEntry('__test__', 'beta');
    expect(beta.title).toBe('Beta');
    expect(beta.year).toBe(2023);
    expect(beta.stack).toEqual(['Python']);
    expect(beta.body.trim()).toBe('Body of beta.');
  });

  it('throws a clear error when slug missing', async () => {
    await expect(loadEntry('__test__', 'missing')).rejects.toThrow(/no content/i);
  });

  it('skips files with no frontmatter rather than crashing', async () => {
    const entries = await loadEntries('__test__');
    expect(entries.find((e) => e.slug === 'bad')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run test, expect failure**

Run:
```bash
npm test -- src/lib/content.test.ts
```
Expected: FAIL with `Cannot find module './content'` (or similar).

- [ ] **Step 5: Implement `src/lib/content.ts`**

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface Entry {
  slug: string;
  title: string;
  subtitle?: string;
  year?: number;
  role?: string;
  affiliation?: string;
  stack?: string[];
  links?: { github?: string; paper?: string; demo?: string; site?: string };
  heroImage?: string;
  order?: number;
  body: string;
}

const CONTENT_ROOT = path.join(process.cwd(), 'src', 'content');

export async function loadEntries(folder: string): Promise<Entry[]> {
  const dir = path.join(CONTENT_ROOT, folder);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const mdx = files.filter((f) => f.endsWith('.mdx'));

  const entries: Entry[] = [];
  for (const file of mdx) {
    const slug = file.replace(/\.mdx$/, '');
    try {
      const entry = await loadEntry(folder, slug);
      entries.push(entry);
    } catch {
      // skip files without valid frontmatter
    }
  }

  return entries.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

export async function loadEntry(folder: string, slug: string): Promise<Entry> {
  const file = path.join(CONTENT_ROOT, folder, `${slug}.mdx`);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch {
    throw new Error(`no content at ${folder}/${slug}.mdx`);
  }
  const { data, content } = matter(raw);
  if (!data || !data.title) {
    throw new Error(`${folder}/${slug}.mdx is missing frontmatter`);
  }
  return {
    slug,
    title: String(data.title),
    subtitle: data.subtitle ? String(data.subtitle) : undefined,
    year: typeof data.year === 'number' ? data.year : undefined,
    role: data.role ? String(data.role) : undefined,
    affiliation: data.affiliation ? String(data.affiliation) : undefined,
    stack: Array.isArray(data.stack) ? data.stack.map(String) : undefined,
    links: data.links && typeof data.links === 'object' ? data.links : undefined,
    heroImage: data.heroImage ? String(data.heroImage) : undefined,
    order: typeof data.order === 'number' ? data.order : undefined,
    body: content,
  };
}
```

- [ ] **Step 6: Run tests, expect pass**

Run:
```bash
npm test
```
Expected: 5 passing tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(content): MDX content loader with frontmatter parsing + tests"
```

---

## Task 12: ProjectCard + /projects list page

**Files:**
- Create: `src/components/content/ProjectCard.tsx`, `src/app/projects/page.tsx`

- [ ] **Step 1: Create `src/components/content/ProjectCard.tsx`**

Note: per spec §2 ("No `text-transform: uppercase`"), stack chips render whatever the author typed, in mono. No `uppercase` class.

```tsx
import Link from 'next/link';
import type { Entry } from '@/lib/content';

export function ProjectCard({ entry, href }: { entry: Entry; href: string }) {
  return (
    <Link
      href={href}
      className="group block py-6 border-b border-rule last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h3 className="font-serif text-h3 text-ink group-hover:text-sage-deep transition-colors">
          {entry.title}
        </h3>
        {entry.year && (
          <span className="font-mono text-tiny text-ink-dim">{entry.year}</span>
        )}
      </div>
      {entry.subtitle && (
        <p className="text-body text-ink-muted mb-3">{entry.subtitle}</p>
      )}
      {entry.stack && entry.stack.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {entry.stack.map((tech) => (
            <li
              key={tech}
              className="font-mono text-tiny text-ink-dim tracking-wide"
            >
              {tech}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Create `src/app/projects/page.tsx`**

```tsx
import { loadEntries } from '@/lib/content';
import { ProjectCard } from '@/components/content/ProjectCard';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'projects — samer aslan' };

export default async function ProjectsPage() {
  const entries = await loadEntries('projects');
  return (
    <PageShell width="list">
      <h1 className="font-serif text-h1 mb-2">projects</h1>
      <p className="text-ink-muted mb-10">
        Personal projects. Work projects (Bloomberg) added when shareable.
      </p>
      {entries.length === 0 ? (
        <p className="text-ink-dim italic">No projects yet.</p>
      ) : (
        <div>
          {entries.map((e) => (
            <ProjectCard key={e.slug} entry={e} href={`/projects/${e.slug}`} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 3: Verify in browser**

Visit http://localhost:3000/projects. Expected: heading, intro line, "No projects yet." italic (since we haven't authored MDX yet).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(projects): add ProjectCard component and /projects list page"
```

---

## Task 13: /projects/[slug] detail page

**Files:**
- Create: `src/app/projects/[slug]/page.tsx`

- [ ] **Step 1: Create `src/app/projects/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import { loadEntries, loadEntry } from '@/lib/content';
import { PageShell } from '@/components/layout/PageShell';

export async function generateStaticParams() {
  const entries = await loadEntries('projects');
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const entry = await loadEntry('projects', slug);
    return { title: `${entry.title} — samer aslan`, description: entry.subtitle };
  } catch {
    return { title: 'project — samer aslan' };
  }
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let entry;
  try {
    entry = await loadEntry('projects', slug);
  } catch {
    notFound();
  }

  return (
    <PageShell width="prose">
      <Link href="/projects" className="font-mono text-tiny text-ink-dim hover:text-sage-deep">
        ← projects
      </Link>
      <header className="mt-4 mb-10">
        <h1 className="font-serif text-h1 mb-2">{entry.title}</h1>
        {entry.subtitle && (
          <p className="text-body text-ink-muted">{entry.subtitle}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-tiny text-ink-dim">
          {entry.year && <span>{entry.year}</span>}
          {entry.role && <span>{entry.role}</span>}
          {entry.stack && entry.stack.length > 0 && <span>{entry.stack.join(' · ')}</span>}
        </div>
        {entry.links && (
          <div className="mt-3 flex flex-wrap gap-x-4 text-small">
            {entry.links.github && (
              <a href={entry.links.github} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">github</a>
            )}
            {entry.links.demo && (
              <a href={entry.links.demo} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">demo</a>
            )}
            {entry.links.site && (
              <a href={entry.links.site} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">site</a>
            )}
            {entry.links.paper && (
              <a href={entry.links.paper} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">paper</a>
            )}
          </div>
        )}
      </header>
      <article className="prose-mdx">
        <MDXRemote source={entry.body} />
      </article>
    </PageShell>
  );
}
```

- [ ] **Step 2: Add a small prose style block to `src/app/globals.css`**

Append at the end:
```css
@layer components {
  .prose-mdx { font-size: 1.0625rem; line-height: 1.7; }
  .prose-mdx > * + * { margin-top: 1.25rem; }
  .prose-mdx h2 { font-family: var(--font-fraunces); font-size: 1.75rem; margin-top: 2.5rem; }
  .prose-mdx h3 { font-family: var(--font-fraunces); font-size: 1.25rem; margin-top: 2rem; }
  .prose-mdx a  { color: var(--color-sage); }
  .prose-mdx a:hover { color: var(--color-sage-deep); }
  .prose-mdx code { font-family: var(--font-jetbrains-mono); font-size: 0.95em; background: var(--color-paper-soft); padding: 0.1em 0.35em; border-radius: 3px; }
  .prose-mdx pre  { font-family: var(--font-jetbrains-mono); background: var(--color-paper-soft); padding: 1rem; border-radius: 4px; overflow-x: auto; }
  .prose-mdx blockquote { border-left: 2px solid var(--color-sage); padding-left: 1rem; color: var(--color-ink-muted); font-style: italic; }
  .prose-mdx ul { list-style: disc; padding-left: 1.25rem; }
  .prose-mdx ol { list-style: decimal; padding-left: 1.25rem; }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(projects): add [slug] detail page with MDX rendering + prose styles"
```

---

## Task 14: Author RecMyRecord + BinSight MDX

**Files:**
- Create: `src/content/projects/recmyrecord.mdx`, `src/content/projects/binsight.mdx`

- [ ] **Step 1: Create `src/content/projects/recmyrecord.mdx`**

```mdx
---
title: "RecMyRecord"
subtitle: "Mood- and audio-based album recommender for cross-genre discovery"
year: 2024
role: "Solo"
stack: ["Next.js", "Python", "Audio features", "Embeddings"]
links:
  site: "https://www.recmyrecord.com"
order: 1
---

A recommender that looks at how an album *sounds* rather than what tag it sits under. The idea: my favorite albums often share sonic qualities that genre labels obscure, so a system that listens to the audio directly should surface cross-genre matches a tag-based recommender never would.

## Approach

Each album is embedded from audio features and surface metadata. Queries return albums whose embeddings sit closest to the input — but the UI also exposes the *direction* of recommendation, so you can ask for "more like this but slower," "more like this but warmer," and so on.

## What's interesting

The cross-genre hits. A jazz record that pairs with an ambient electronic record because both move at the same pulse with the same dynamic range — that connection isn't in any tag, but it's in the audio.

## Status

Live at [recmyrecord.com](https://www.recmyrecord.com). Pairs thematically with the [music map](/music) on this site.
```

- [ ] **Step 2: Create `src/content/projects/binsight.mdx`**

```mdx
---
title: "BinSight"
subtitle: "Lightweight vision-based waste sorting"
year: 2023
role: "Hackathon project"
stack: ["Python", "PyTorch", "Computer vision", "Edge inference"]
links:
  github: "https://github.com/sameraslan/BinSight"
order: 2
---

A small computer vision system that classifies waste items at the bin so they end up in the right stream. Built to run on cheap hardware — the constraint was honest deployability, not benchmark scores.

## Approach

A compact CNN fine-tuned on a curated waste-image set, quantized for inference on a small board. The interesting work is at the seams: image capture under bad lighting, fast classification, a hardware path that doesn't require a person to maintain it.

## Why

Recycling streams fail when contamination crosses thresholds set by sorting facilities. A small classifier at the bin catches the wrong items before they enter the stream — cheaper than fixing it downstream.
```

- [ ] **Step 3: Verify in browser**

Visit http://localhost:3000/projects. Expected: two project cards (RecMyRecord, then BinSight by order). Click into each — detail page renders with title, subtitle, metadata strip, links, and MDX body.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "content(projects): add RecMyRecord and BinSight"
```

---

## Task 15: ResearchCard + /research list page

**Files:**
- Create: `src/components/content/ResearchCard.tsx`, `src/app/research/page.tsx`

- [ ] **Step 1: Create `src/components/content/ResearchCard.tsx`**

```tsx
import Link from 'next/link';
import type { Entry } from '@/lib/content';

export function ResearchCard({ entry, href }: { entry: Entry; href: string }) {
  return (
    <Link
      href={href}
      className="group block py-6 border-b border-rule last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h3 className="font-serif text-h3 text-ink group-hover:text-sage-deep transition-colors">
          {entry.title}
        </h3>
        {entry.year && (
          <span className="font-mono text-tiny text-ink-dim">{entry.year}</span>
        )}
      </div>
      {entry.subtitle && (
        <p className="text-body text-ink-muted mb-2">{entry.subtitle}</p>
      )}
      {entry.affiliation && (
        <p className="font-mono text-tiny text-ink-dim tracking-wide">
          {entry.affiliation}
        </p>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Create `src/app/research/page.tsx`**

```tsx
import { loadEntries } from '@/lib/content';
import { ResearchCard } from '@/components/content/ResearchCard';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'research — samer aslan' };

export default async function ResearchPage() {
  const entries = await loadEntries('research');
  return (
    <PageShell width="list">
      <h1 className="font-serif text-h1 mb-2">research</h1>
      <p className="text-ink-muted mb-10">
        Academic work, mostly at JHU. Neuro-AI, language models, perception.
      </p>
      {entries.length === 0 ? (
        <p className="text-ink-dim italic">No research entries yet.</p>
      ) : (
        <div>
          {entries.map((e) => (
            <ResearchCard key={e.slug} entry={e} href={`/research/${e.slug}`} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(research): add ResearchCard and /research list page"
```

---

## Task 16: /research/[slug] detail page

**Files:**
- Create: `src/app/research/[slug]/page.tsx`

- [ ] **Step 1: Create `src/app/research/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import { loadEntries, loadEntry } from '@/lib/content';
import { PageShell } from '@/components/layout/PageShell';

export async function generateStaticParams() {
  const entries = await loadEntries('research');
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const entry = await loadEntry('research', slug);
    return { title: `${entry.title} — samer aslan`, description: entry.subtitle };
  } catch {
    return { title: 'research — samer aslan' };
  }
}

export default async function ResearchDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let entry;
  try {
    entry = await loadEntry('research', slug);
  } catch {
    notFound();
  }

  return (
    <PageShell width="prose">
      <Link href="/research" className="font-mono text-tiny text-ink-dim hover:text-sage-deep">
        ← research
      </Link>
      <header className="mt-4 mb-10">
        <h1 className="font-serif text-h1 mb-2">{entry.title}</h1>
        {entry.subtitle && (
          <p className="text-body text-ink-muted">{entry.subtitle}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-tiny text-ink-dim">
          {entry.year && <span>{entry.year}</span>}
          {entry.affiliation && <span>{entry.affiliation}</span>}
          {entry.stack && entry.stack.length > 0 && <span>{entry.stack.join(' · ')}</span>}
        </div>
        {entry.links && (
          <div className="mt-3 flex flex-wrap gap-x-4 text-small">
            {entry.links.github && (
              <a href={entry.links.github} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">code</a>
            )}
            {entry.links.paper && (
              <a href={entry.links.paper} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">paper</a>
            )}
          </div>
        )}
      </header>
      <article className="prose-mdx">
        <MDXRemote source={entry.body} />
      </article>
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(research): add [slug] detail page with MDX rendering"
```

---

## Task 17: Author DiaLong + PerceptAlign MDX

**Files:**
- Create: `src/content/research/dialong.mdx`, `src/content/research/perceptalign.mdx`

- [ ] **Step 1: Create `src/content/research/dialong.mdx`**

```mdx
---
title: "DiaLong"
subtitle: "Benchmarking reminiscence in long-context dialogues"
year: 2024
role: "Researcher"
affiliation: "JHU CLSP"
stack: ["Python", "PyTorch", "HuggingFace"]
links:
  github: "https://github.com/sameraslan/DiaLong"
order: 1
---

A benchmark for testing whether long-context language models actually *remember* — not just whether they can be cued to retrieve. Reminiscence is harder than retrieval: it's the model raising prior dialogue context on its own when relevant, without being asked to.

## Why this benchmark

Existing long-context evals measure retrieval: drop a needle in a haystack, ask for it back. That tells you the context window works. It doesn't tell you the model uses prior context the way a human conversational partner would — surfacing earlier topics, callbacks, contradictions — when nothing in the prompt explicitly asks.

## What we measure

Multi-turn dialogues where the natural follow-up requires the model to bring back something said many turns earlier *unprompted*. Scoring is human-validated against held-out conversational patterns.

## Status

Code at [github.com/sameraslan/DiaLong](https://github.com/sameraslan/DiaLong).
```

- [ ] **Step 2: Create `src/content/research/perceptalign.mdx`**

```mdx
---
title: "PerceptAlign"
subtitle: "Real-time temporal alignment for audio generation from silent video"
year: 2025
role: "Researcher"
affiliation: "JHU Dynamic Perception Lab"
stack: ["Python", "PyTorch", "Multimodal", "Audio"]
links:
  github: "https://github.com/sameraslan/PerceptAlign"
order: 2
---

A system for generating audio that's temporally aligned to silent video — in real time. The interesting subproblem isn't generation quality but synchronization: the predicted audio has to land *with* the visual event, not after it.

## Approach

A latency-aware decoder conditioned on visual stream features, trained against an alignment loss that penalizes asynchrony separately from acoustic plausibility. Online inference uses a short look-ahead window calibrated to the visual frame rate.

## Why this matters

Most video-to-audio work optimizes for plausibility offline. Real-time alignment is the bottleneck for any application where a human watches the output as it generates — accessibility tools, prototyping, live captioning of sound for the hearing-impaired.

## Status

Code at [github.com/sameraslan/PerceptAlign](https://github.com/sameraslan/PerceptAlign).
```

- [ ] **Step 3: Verify in browser**

Visit /research, /research/dialong, /research/perceptalign. Both list and detail pages should render.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "content(research): add DiaLong and PerceptAlign"
```

---

## Task 18: /about page

**Files:**
- Create: `src/components/content/AboutHeader.tsx`, `src/app/about/page.tsx`
- Asset: ensure `public/images/avatar.jpg` is present (preserved in Task 1)

- [ ] **Step 1: Create `src/components/content/AboutHeader.tsx`**

```tsx
import Image from 'next/image';

export function AboutHeader() {
  return (
    <div className="flex flex-col sm:flex-row gap-8 mb-10">
      <div className="shrink-0">
        <Image
          src="/images/avatar.jpg"
          alt="Samer Aslan"
          width={280}
          height={280}
          className="rounded-sm"
          priority
        />
      </div>
      <div className="space-y-4 text-body">
        <p>
          Samer Aslan — software engineer at Bloomberg, alum of Johns Hopkins (CS, Computer Engineering,
          Cognitive Science). Based in New York.
        </p>
        <p className="text-ink-muted">
          Speaks English, Turkish, Spanish.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/about/page.tsx`**

```tsx
import { AboutHeader } from '@/components/content/AboutHeader';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'about — samer aslan' };

export default function AboutPage() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 mb-8">about</h1>
      <AboutHeader />
      <div className="space-y-6 text-body">
        <p>
          I'm passionate about blending cutting-edge AI and machine learning research with engineering to
          develop innovative solutions that create meaningful and positive experiences for people.
        </p>
        <p>
          My non-tech interests include human psychology and behavior, the brain and its role in sensation
          and perception, art (especially music and its influence on cognition), and the intersection of
          nutrition and human well-being.
        </p>
        <p>
          I'm always open to speaking with others who share similar interests or are working on related
          projects — feel free to reach out.
        </p>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 3: Verify in browser**

Visit /about. Expected: 280px square avatar, intro block beside on desktop / stacked on mobile, then three paragraphs of bio. Text-led max-width.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(about): add /about with photo + bio"
```

---

## Task 19: /now page

**Files:**
- Create: `src/app/now/page.tsx`

- [ ] **Step 1: Create `src/app/now/page.tsx`**

```tsx
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'now — samer aslan' };

const LAST_UPDATED = '2026-05-15';

export default function NowPage() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 mb-2">now</h1>
      <p className="font-mono text-tiny text-ink-dim mb-10">a /now page · what I'm focused on these days</p>

      <div className="space-y-6 text-body">
        <p>
          Working at Bloomberg as a software engineer. Most of my day is in the equities space — the projects
          I can talk about publicly will end up on <a href="/projects" className="text-sage hover:text-sage-deep">projects</a>.
        </p>
        <p>
          Reading more about how perception works in the brain — particularly around audio and cross-modal
          binding. The music map on this site is the visible end of that interest.
        </p>
        <p>
          Listening to a lot of jazz lately and slowly making the listening map richer.
        </p>
      </div>

      <p className="mt-12 font-mono text-tiny text-ink-dim">last updated {LAST_UPDATED}</p>
    </PageShell>
  );
}
```

- [ ] **Step 2: Verify in browser**

Visit /now. Expected: heading, mono caption, three paragraphs, last-updated date in mono at bottom.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(now): add /now page"
```

---

## Task 20: /misc page

**Files:**
- Create: `src/app/misc/page.tsx`

- [ ] **Step 1: Create `src/app/misc/page.tsx`**

```tsx
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'misc — samer aslan' };

export default function MiscPage() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 mb-8">misc</h1>

      <section className="mb-12">
        <h2 className="font-serif text-h2 mb-4">brain & cognition</h2>
        <p className="text-body text-ink-muted">
          Notes and links coming. Interested in perception, cross-modal binding, the neuroscience of music,
          and how the brain stitches sensory streams into a single experience.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h2 mb-4">books</h2>
        <p className="text-body text-ink-muted">
          A running list of books I'd recommend, with a one-line note each. Coming soon.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h2 mb-4">nutrition</h2>
        <p className="text-body text-ink-muted">
          Notes on nutrition and well-being. Coming soon.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-h2 mb-4">links</h2>
        <p className="text-body text-ink-muted">
          Things I've come back to. Coming soon.
        </p>
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 2: Verify in browser**

Visit /misc. Expected: four sections with light placeholder copy.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(misc): add /misc page with section placeholders"
```

---

## Task 21: /music page (embedded map + cross-link to RecMyRecord)

**Files:**
- Create: `src/components/content/CrossLinkCard.tsx`, `src/app/music/page.tsx`

- [ ] **Step 1: Create `src/components/content/CrossLinkCard.tsx`**

```tsx
import Link from 'next/link';

export function CrossLinkCard({
  href,
  title,
  description,
  external = false,
}: {
  href: string;
  title: string;
  description: string;
  external?: boolean;
}) {
  const Component: typeof Link | 'a' = external ? 'a' : Link;
  const props = external
    ? { href, target: '_blank', rel: 'noreferrer' }
    : { href };

  return (
    <Component
      {...(props as { href: string })}
      className="block p-6 bg-paper-soft border border-rule rounded-sm hover:border-sage transition-colors group"
    >
      <p className="font-mono text-tiny text-ink-dim mb-2 tracking-wide">
        related project →
      </p>
      <h3 className="font-serif text-h3 text-ink group-hover:text-sage-deep transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-body text-ink-muted">{description}</p>
    </Component>
  );
}
```

- [ ] **Step 2: Create `src/app/music/page.tsx`**

```tsx
import { loadListening } from '@/lib/music-data';
import { MusicMap } from '@/components/music-map/MusicMap';
import { MusicMapCaption } from '@/components/music-map/MusicMapCaption';
import { CrossLinkCard } from '@/components/content/CrossLinkCard';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'music — samer aslan' };

export default async function MusicPage() {
  const data = await loadListening();

  return (
    <PageShell width="prose">
      <h1 className="font-serif text-h1 mb-2">music</h1>
      <p className="text-ink-muted mb-10">
        a map of my listening — proximity by sound, color by mood
      </p>

      <div className="w-full mb-2">
        <MusicMap width={680} height={420} data={data} />
      </div>
      <MusicMapCaption text="hover an album to see what's near it" />

      <section className="mt-16 space-y-6 text-body">
        <h2 className="font-serif text-h2">how the map is built</h2>
        <p>
          Each album is positioned by how it sounds, not by what genre tag it carries. Audio features and
          surface metadata feed an embedding; nearby points are albums that share sonic qualities even when
          their genre labels are far apart.
        </p>
        <p>
          Color encodes a cluster — a rough mood / texture category. The clusters aren't strict genres; they
          emerge from the audio.
        </p>
        <p>
          The data is just a JSON file on this site. The viz itself is a separate component that will keep
          improving as I add albums and refine the embedding.
        </p>
      </section>

      <section className="mt-16">
        <CrossLinkCard
          href="https://www.recmyrecord.com"
          external
          title="RecMyRecord"
          description="If this idea — finding music by how it sounds rather than how it's tagged — interests you, RecMyRecord is the full version: an album recommender built on the same intuition."
        />
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 3: Verify in browser**

Visit /music. Expected: heading, caption strip, embedded SVG map (smaller than homepage), explainer paragraphs, then a cross-link card pointing to RecMyRecord.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(music): add /music page with embedded map and RecMyRecord cross-link"
```

---

## Task 22: End-to-end verification (manual walk-through)

**Files:** none.

- [ ] **Step 1: Visit each route at desktop width (≥1024px)**

For each URL, check the listed expectations:

| URL | Expected |
|---|---|
| `/` | Sidebar left, music map fills right canvas, caption below in muted italic. |
| `/about` | Avatar 280px, intro beside, three paragraphs. Active nav item: `about` (sage). |
| `/projects` | Heading, RecMyRecord then BinSight cards with year on right. |
| `/projects/recmyrecord` | Back link, title, subtitle, metadata strip, "site" link in sage, MDX body. |
| `/projects/binsight` | Same shape, "github" link in sage. |
| `/research` | Heading, DiaLong then PerceptAlign cards with JHU affiliation in mono. |
| `/research/dialong` | Back link, title, MDX body. |
| `/research/perceptalign` | Same. |
| `/music` | Heading, embedded map, three paragraph essay, RecMyRecord cross-link card. |
| `/misc` | Four sub-headings with placeholder copy. |
| `/now` | Three paragraphs + last-updated date in mono. |
| `/not-a-page` | 404 with "go home" link in sage. |

- [ ] **Step 2: Resize to <768px and re-walk every route**

Expected on every page:
- Sidebar disappears; mobile top-nav shows `samer aslan` as large heading then nav items separated by `·`.
- External links (`email · github · linkedin`) appear at the bottom of the page above a top border.
- Music map on `/` and `/music` fits the narrower viewport without overflow.

- [ ] **Step 3: Visual diff against approved mockups**

Open the two HTML files side-by-side with the running site:
- `docs/superpowers/specs/mockups/2026-05-12-sage-on-linen.html` — same overall theme density, palette, type
- `docs/superpowers/specs/mockups/2026-05-12-boran-inspiration.html` — same sidebar + full-canvas hero pattern on `/`

Anything materially different from the approved mockup is a defect — fix before moving on.

- [ ] **Step 4: Run lint and build**

Run:
```bash
npm run lint && npm run build
```
Expected: no lint errors, build succeeds.

- [ ] **Step 5: Run Lighthouse on the production build**

First stop the dev server that's been running since Task 2 (Ctrl-C in its terminal) so port 3000 is free.

Then in one terminal:
```bash
npm run build && npm start
```

In another, open http://localhost:3000 in Chrome incognito, open DevTools → Lighthouse, run a Desktop audit on Performance + Accessibility.

Expected: Performance ≥ 90, Accessibility ≥ 95. If under, capture the report and fix the biggest contributor before moving on (most common offenders: missing image dimensions, font preload, missing `<html lang>` — `lang` is already set in our root layout so that one should be fine).

Stop the `npm start` server when done. Restart the dev server if you'll continue working: `npm run dev`.

- [ ] **Step 6: Commit any fixes from this task**

If fixes were made, commit them:
```bash
git add -A
git commit -m "fix: address verification walkthrough findings"
```

---

## Task 23: Write `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add README"
```

---

## Task 24: Write `docs/architecture.md`

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 1: Create `docs/architecture.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add architecture overview"
```

---

## Task 25: Write `docs/content-authoring.md`

**Files:**
- Create: `docs/content-authoring.md`

- [ ] **Step 1: Create `docs/content-authoring.md`**

```markdown
# Content authoring

How to add or update content on the site. No code changes required for most updates.

## Add a project

1. Create `src/content/projects/<slug>.mdx`. The slug becomes the URL: `/projects/<slug>`.
2. Add frontmatter at the top:

   ```yaml
   ---
   title: "Project Title"
   subtitle: "One-line description shown under the title and on the projects list"
   year: 2025
   role: "Solo"                          # or "Co-lead", "Hackathon project", etc.
   stack: ["TypeScript", "Postgres"]      # appears as tiny mono chips
   links:
     site:   "https://example.com"
     github: "https://github.com/sameraslan/repo"
     demo:   "https://demo.example.com"
   order: 3                              # lower = higher in the list
   ---
   ```

3. Write the body in Markdown below the frontmatter. Headings (`##`, `###`), links, lists, code blocks, blockquotes all work — they're styled by `.prose-mdx` in `src/app/globals.css`.
4. The page builds automatically. Visit `/projects/<slug>` in dev.

### Frontmatter reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Card heading and detail-page title |
| `subtitle` | string | no | One-line description, ink-muted |
| `year` | number | no | Appears top-right of the card and in the detail metadata strip |
| `role` | string | no | "Solo", "Hackathon project", etc. |
| `stack` | string[] | no | Mono chips; lowercase recommended |
| `links.github` | url | no | Renders as "github" link |
| `links.site` | url | no | Renders as "site" link |
| `links.demo` | url | no | Renders as "demo" link |
| `links.paper` | url | no | Renders as "paper" link |
| `heroImage` | path | no | Reserved for a future hero-image block; not currently rendered |
| `order` | number | no | Sort key. Ascending. Missing = last. Tie-break: year descending. |

## Add a research entry

Same as a project. File goes under `src/content/research/<slug>.mdx`. URL: `/research/<slug>`.

The frontmatter accepts one extra field:

```yaml
affiliation: "JHU CLSP"   # rendered as a mono caption on the card and detail
```

The `links` block has the same shape; on research pages, `github` is labeled "code".

## Update `/about`

`src/app/about/page.tsx`. The avatar lives at `public/images/avatar.jpg` — replace the file to swap it (keep the dimensions 1:1, ≥560px each side so it's sharp on retina).

Bio paragraphs are plain JSX. Edit the file.

## Update `/now`

`src/app/now/page.tsx`. Two things to keep in mind:

1. Update the paragraphs.
2. **Bump the `LAST_UPDATED` constant** at the top of the file. The footer line displays this. The point of a `/now` page is the date — readers should know how stale the snapshot is.

## Update `/misc`

`src/app/misc/page.tsx`. Each section is a `<section>` with an `h2` and a paragraph. Add sections, remove sections, link to anything you want. No schema.

## Update the music-map data

Edit `public/data/listening.json`. Schema:

```json
{
  "id": "unique-string",
  "title": "Album Title",
  "artist": "Artist Name",
  "year": 1972,
  "x": 0.27,        // horizontal position, 0–1
  "y": 0.71,        // vertical position, 0–1
  "cluster": "olive",
  "coverUrl": ""    // path or full URL; empty for now
}
```

`x` and `y` are normalized to the visualization canvas. `cluster` accepts: `sage`, `olive`, `forest`, `oxblood`, `terracotta`, `amber`, `slate`, `plum`.

Once the parallel viz session lands, positions may be generated from an audio embedding instead of hand-placed — at which point this file becomes machine-generated rather than hand-edited.

## Update nav or external links

Edit `src/lib/site-config.ts`. The `nav` array drives the sidebar / mobile-nav order; the `external` array drives `email / github / linkedin` (and any future links).

## Update the homepage tagline

`src/lib/site-config.ts` → `tagline`. Appears as the italic caption under the music map on `/`.

## Tone

Lowercase nav and section labels. Sentence case in body. No uppercase styling. Em dashes are fine (—). Sage is the only accent color — don't reach for highlights.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add content authoring guide"
```

---

## Task 26: Vercel preview deploy

**Files:** none.

- [ ] **Step 1: Confirm Vercel CLI is installed**

Run:
```bash
vercel --version
```
If not installed, ask the user to install: `npm i -g vercel@latest`. (The harness notes the existing local install is outdated — `npm i -g vercel@latest` is the recommended upgrade.)

- [ ] **Step 2: Confirm the project is linked to Vercel**

Run:
```bash
ls .vercel 2>/dev/null || vercel link
```
If `.vercel/` already exists, the project is linked. If not, `vercel link` will prompt to connect to the existing project — pick the existing `sameraslan` project so the production URL stays stable.

- [ ] **Step 3: Push the worktree branch to origin and open a PR**

Run:
```bash
git push -u origin worktree-new_ui
gh pr create --title "redesign: sage-on-linen personal site" --body "$(cat <<'EOF'
## Summary
- Replaces the Once UI Magic Portfolio template with a fresh sage-on-linen design
- Hero is an album proximity music-map placeholder (real viz lands in a follow-up)
- MDX-based content for projects + research
- Includes README, architecture, and content-authoring docs

## Spec
See [docs/superpowers/specs/2026-05-12-personal-website-design.md](docs/superpowers/specs/2026-05-12-personal-website-design.md).

## Test plan
- [ ] Vercel preview renders all routes
- [ ] Visual diff against approved mockups passes
- [ ] Mobile (<768px) walk-through clean
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for the Vercel preview URL and walk through it**

Get the preview URL from the PR (gh pr view --json statusCheckRollup or the PR page).

Walk through every route on the preview as in Task 22 Step 1. Pay special attention to:

- Font loading (no FOUT)
- Image loading (avatar on /about, album thumbnails if added)
- 404 page

If anything differs from local, capture the difference and fix before merging.

- [ ] **Step 5: Done**

Implementation is complete when the preview is clean. The user merges when ready.

---

## Self-review

### Spec coverage

Walking the spec section by section:

- **§1 Concept** — Embodied in every visual choice across Tasks 3–10.
- **§2 Visual system** — Task 3 wires colors, fonts, type scale, spacing.
- **§3 Information architecture** — Sitemap implemented in Tasks 8, 10–21. Content model split (TSX vs MDX) honored.
- **§3 About copy** — Task 18 uses the starting-draft copy from the spec verbatim.
- **§3 Initial entries** — Tasks 14 (projects) and 17 (research) include the four named entries.
- **§4 Layout system** — Two-column desktop, mobile top-nav, per-page max-widths in Tasks 5–8.
- **§5 Music-map integration** — Component contract in Task 9, fallback handling, caption strip rendered by site (not component), embedded in `/` (Task 10) and `/music` (Task 21).
- **§5 Viz palette** — Encoded in `CLUSTER_COLORS` in Task 9; documented for the parallel session in architecture doc (Task 24).
- **§6 Stack** — Task 2 installs Next 16, React 19, Tailwind 4, TS strict, MDX deps, Vitest.
- **§6 Migration strategy** — Task 1 is the "nuke and start fresh" with avatar preserved.
- **§6 Repo structure** — File layout matches.
- **§6 MDX frontmatter** — Spec sample mirrored in Tasks 11 (loader types) and Task 25 (authoring doc).
- **§6 Documentation deliverable** — Tasks 23, 24, 25 produce README, architecture, content-authoring docs.
- **§7 Out of scope** — Nothing in the plan crosses this line.
- **§8 Verification plan** — Task 22 covers manual walk-through, mockup diff, Lighthouse. Task 26 covers Vercel preview deploy.
- **§9 Open questions** — Acknowledged: type sizes default to spec values; sidebar appears instantly (no fade-in for now); music-map schema treated as draft contract; about copy is the starting draft.

No gaps.

### Placeholder scan

Searched for "TBD", "TODO", "implement later", "fill in details", "similar to Task N", "appropriate error handling". None found. All code blocks contain real code; all commands have expected output.

### Type consistency

- `Entry` type defined in Task 11 (`src/lib/content.ts`), consumed in Tasks 12, 13, 15, 16. Field names match.
- `AlbumPoint` defined in Task 9 (`src/lib/music-data.ts`), re-exported from `MusicMap.tsx`, consumed in `MusicMapHero` and `/music`. Names match.
- `siteConfig.nav` shape in Task 4, consumed in Tasks 5 and 6. Same `{ label, href }` shape.
- `<PageShell width="...">` accepts `'full' | 'text' | 'list' | 'prose'` (Task 7); every consumer uses one of those four. Verified Tasks 8, 12, 13, 15, 16, 18, 19, 20, 21.

No inconsistencies.
