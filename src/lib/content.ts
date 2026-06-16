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
