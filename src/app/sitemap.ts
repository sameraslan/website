import type { MetadataRoute } from 'next';
import { loadEntries } from '@/lib/content';

const SITE_URL = 'https://www.sameraslan.com';

// Lists the public pages and the papers hosted under /papers so crawlers,
// Google Scholar's included, find them. Unlisted notes stay out.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/about', '/projects', '/research', '/music', '/art'].map((p) => ({ url: `${SITE_URL}${p}` }));
  const entries = [
    ...(await loadEntries('projects')).map((e) => ({ kind: 'projects', e })),
    ...(await loadEntries('research')).map((e) => ({ kind: 'research', e })),
  ];
  const entryPages = entries.map(({ kind, e }) => ({ url: `${SITE_URL}/${kind}/${e.slug}` }));
  const papers = entries
    .map(({ e }) => e.links?.paper)
    .filter((href): href is string => !!href && href.startsWith('/'))
    .map((href) => ({ url: `${SITE_URL}${href}` }));
  return [...pages, ...entryPages, ...papers];
}
