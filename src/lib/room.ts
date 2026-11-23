// Data and pure helpers for the /notes room (the blog landing page).
// Framework-free and safe to import from client components: no node:fs here.
// The server-only post loader lives in ./room-posts.ts.
import artData from '@/data/room/art.json';
import albumData from '@/data/room/albums.json';

// Placeholder name; the single source for the blog's name.
export const BLOG_NAME = 'Ghost Notes';
export const POSTS_PER_PAGE = 6;

export interface ArtPiece {
  id: string;
  artist: string;
  title: string;
  year: string;
  width: number;
  height: number;
  role: 'wall' | 'window-view';
}

export interface Album {
  id: string;
  artist: string;
  title: string;
  year: string;
  type: string;
  width: number;
  height: number;
  hasCover: boolean;
}

export interface RoomPost {
  href: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  dateLabel: string; // e.g. "Oct 18, 2026"
}

export const ART: ArtPiece[] = artData as ArtPiece[];
export const ALBUMS: Album[] = albumData as Album[];

export function artSrc(id: string, size: 'wall' | 'full'): string {
  return size === 'wall' ? `/images/room/art/${id}-480.webp` : `/images/room/art/${id}.webp`;
}

export function albumSrc(id: string, size: 'wall' | 'full'): string {
  return size === 'wall' ? `/images/room/albums/${id}-320.webp` : `/images/room/albums/${id}.webp`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-18" -> "Oct 18, 2026". Read in UTC so the day never shifts.
export function formatPostDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Splits items into pages. Empty input gives no pages at all.
export function paginate<T>(items: T[], perPage: number = POSTS_PER_PAGE): T[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export function sortPostsNewestFirst<T extends { date: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// A stable integer for the local calendar day of `d` (yyyymmdd).
export function dailySeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic Fisher-Yates shuffle; returns a new array and leaves `items` alone.
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function artistKey(artist: string): string {
  return artist.trim().toLowerCase().replace(/^the\s+/, '');
}

// Sorted by artist, then year, case-insensitive and ignoring a leading "The ".
export function albumsByArtist(albums: Album[]): Album[] {
  return [...albums].sort((a, b) => {
    const byArtist = artistKey(a.artist).localeCompare(artistKey(b.artist), 'en');
    if (byArtist !== 0) return byArtist;
    return a.year.localeCompare(b.year, 'en', { numeric: true });
  });
}

// Everything in the record crate: all albums, by artist. Albums without a
// cover are included and shown as white-label sleeves.
export const CRATE_ALBUMS: Album[] = albumsByArtist(ALBUMS);
