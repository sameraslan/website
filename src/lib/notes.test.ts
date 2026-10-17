// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listNoteSlugs, loadNote, noteMetadata, NOTES_DIR } from './notes';
import { loadEntries } from './content';
import { siteConfig } from './site-config';

// Unlisted notes must be reachable only by their URL. These checks cover every
// place the site could surface a page: nav, content lists, the search index,
// a sitemap / robots / RSS route, and any link in the source or public files.

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

async function walk(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(full, exts)));
    else if (exts.some((e) => d.name.endsWith(e))) out.push(full);
  }
  return out;
}

// Next.js metadata routes and feed routes that would list pages if added.
const ROUTE_CANDIDATES = [
  'app/sitemap.ts', 'app/sitemap.tsx', 'app/sitemap.js',
  'app/robots.ts', 'app/robots.js',
  'app/rss.xml/route.ts', 'app/feed.xml/route.ts', 'app/atom.xml/route.ts',
  'app/rss/route.ts', 'app/feed/route.ts',
].map((p) => path.join(SRC, p));
const STATIC_CANDIDATES = ['sitemap.xml', 'robots.txt', 'rss.xml', 'feed.xml', 'atom.xml'].map((p) =>
  path.join(PUBLIC, p),
);

async function routeOutput(file: string): Promise<string> {
  const mod = await import(/* @vite-ignore */ pathToFileURL(file).href);
  if (typeof mod.default === 'function') return JSON.stringify(await mod.default());
  if (typeof mod.GET === 'function') return await (await mod.GET(new Request('https://www.sameraslan.com/'))).text();
  return '';
}

const slugs = await listNoteSlugs();

describe('unlisted notes', () => {
  it('has the unimap interpretability note', () => {
    expect(slugs.some((s) => s.startsWith('unimap-interpretability-'))).toBe(true);
  });

  it('serves every note with noindex, nofollow', async () => {
    for (const slug of slugs) {
      const meta = noteMetadata(await loadNote(slug));
      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });

  it('keeps notes out of src/content and has no /notes index page', async () => {
    expect(NOTES_DIR.startsWith(path.join(SRC, 'content'))).toBe(false);
    expect(existsSync(path.join(SRC, 'app', '(pages)', 'notes', 'page.tsx'))).toBe(false);
    expect(existsSync(path.join(SRC, 'app', 'notes', 'page.tsx'))).toBe(false);
  });

  it('is absent from the nav and footer links', () => {
    const hrefs = [...siteConfig.nav, ...siteConfig.external].map((i) => i.href);
    for (const href of hrefs) expect(href.startsWith('/notes')).toBe(false);
    for (const slug of slugs) expect(JSON.stringify(siteConfig)).not.toContain(slug);
  });

  it('is absent from every content list', async () => {
    const folders = (await fs.readdir(path.join(SRC, 'content'), { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const folder of folders) {
      const listed = (await loadEntries(folder)).map((e) => e.slug);
      for (const slug of slugs) expect(listed).not.toContain(slug);
    }
  });

  it('is absent from the search index (the fuse.js data in public/data)', async () => {
    const files = await walk(path.join(PUBLIC, 'data'), ['.json']);
    expect(files.some((f) => f.endsWith('metadata.json'))).toBe(true);
    for (const f of files) {
      const text = await fs.readFile(f, 'utf-8');
      for (const slug of slugs) expect(text, f).not.toContain(slug);
      expect(text, f).not.toContain('/notes/');
    }
  });

  it('is absent from any sitemap, robots or RSS output', async () => {
    for (const file of ROUTE_CANDIDATES.filter((f) => existsSync(f))) {
      const out = await routeOutput(file);
      for (const slug of slugs) expect(out, file).not.toContain(slug);
    }
    for (const file of STATIC_CANDIDATES.filter((f) => existsSync(f))) {
      const out = await fs.readFile(file, 'utf-8');
      for (const slug of slugs) expect(out, file).not.toContain(slug);
    }
  });

  it('is not linked from any other source or public file', async () => {
    const files = [
      ...(await walk(SRC, ['.ts', '.tsx', '.js', '.mjs', '.mdx', '.md', '.json', '.css'])),
      ...(await walk(PUBLIC, ['.json', '.xml', '.txt', '.html'])),
    ].filter((f) => !f.startsWith(NOTES_DIR + path.sep));
    for (const f of files) {
      const text = await fs.readFile(f, 'utf-8');
      for (const slug of slugs) expect(text, f).not.toContain(slug);
    }
  });
});
