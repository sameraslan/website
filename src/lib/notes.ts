import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { parseEntry, type Entry } from './content';

// Unlisted notes: pages reachable only by their URL, /notes/<slug>.
//
// They live in src/notes/, outside src/content/, so the project and research
// lists (loadEntries('projects' | 'research')) never see them. The blog index
// at /notes (src/app/notes/page.tsx) lists them, but it is itself served with
// noindex/nofollow and linked from nowhere on the site, and every note is
// served with noindex/nofollow too. src/lib/notes.test.ts checks all of this.
//
// A note appears on the /notes board once its frontmatter has a `date`
// (loadRoomPosts in src/lib/room-posts.ts); without one it is only reachable by
// its URL. Write the date quoted, as "yyyy-mm-dd": an unquoted impossible date
// such as 2026-02-30 is turned into a real one by the YAML parser before we see it.
export const NOTES_DIR = path.join(process.cwd(), 'src', 'notes');

export async function listNoteSlugs(): Promise<string[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(NOTES_DIR);
  } catch {
    return [];
  }
  return files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
}

export async function loadNote(slug: string): Promise<Entry> {
  const file = path.join(NOTES_DIR, `${slug}.mdx`);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch {
    throw new Error(`no note at notes/${slug}.mdx`);
  }
  return parseEntry(raw, slug, `notes/${slug}.mdx`);
}

export const NOTE_ROBOTS = { index: false, follow: false } as const;

export function noteMetadata(entry?: Entry): Metadata {
  return {
    title: entry ? `${entry.title} · samer aslan` : 'samer aslan',
    description: entry?.subtitle,
    authors: entry?.author ? [{ name: entry.author }] : undefined,
    robots: NOTE_ROBOTS,
  };
}
