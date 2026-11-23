import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface Entry {
  slug: string;
  title: string;
  subtitle?: string;
  author?: string;
  year?: number;
  date?: string; // ISO yyyy-mm-dd
  role?: string;
  affiliation?: string;
  venue?: string;
  stack?: string[];
  links?: { github?: string; paper?: string; demo?: string; site?: string };
  heroImage?: string;
  order?: number;
  citation?: Citation;
  body: string;
}

// Bibliographic details for a paper hosted on the site, emitted as Google Scholar
// citation meta tags on the entry's page.
export interface Citation {
  title: string;
  authors: string[];
  date: string;
  institution?: string;
}

function parseCitation(raw: unknown): Citation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  if (!c.title || !Array.isArray(c.authors) || !c.date) return undefined;
  return {
    title: String(c.title),
    authors: c.authors.map(String),
    date: String(c.date),
    institution: c.institution ? String(c.institution) : undefined,
  };
}

// gray-matter hands back a JS Date for an unquoted YAML date and a string for a
// quoted one. Both become yyyy-mm-dd; anything that is not a real date is dropped.
function parseDate(raw: unknown): string | undefined {
  let iso: string | undefined;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return undefined;
    iso = raw.toISOString().slice(0, 10);
  } else if (typeof raw === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!m) return undefined;
    iso = m[0];
  } else {
    return undefined;
  }
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return undefined;
  return iso;
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
  return parseEntry(raw, slug, `${folder}/${slug}.mdx`);
}

// Shared by loadEntry and the unlisted-notes loader (src/lib/notes.ts).
export function parseEntry(raw: string, slug: string, label: string): Entry {
  const { data, content } = matter(raw);
  if (!data || !data.title) {
    throw new Error(`${label} is missing frontmatter`);
  }
  return {
    slug,
    title: String(data.title),
    subtitle: data.subtitle ? String(data.subtitle) : undefined,
    author: data.author ? String(data.author) : undefined,
    year: typeof data.year === 'number' ? data.year : undefined,
    date: parseDate(data.date),
    role: data.role ? String(data.role) : undefined,
    affiliation: data.affiliation ? String(data.affiliation) : undefined,
    venue: data.venue ? String(data.venue) : undefined,
    stack: Array.isArray(data.stack) ? data.stack.map(String) : undefined,
    links: data.links && typeof data.links === 'object' ? data.links : undefined,
    heroImage: data.heroImage ? String(data.heroImage) : undefined,
    order: typeof data.order === 'number' ? data.order : undefined,
    citation: parseCitation(data.citation),
    body: content,
  };
}
