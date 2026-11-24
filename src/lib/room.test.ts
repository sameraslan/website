// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  ALBUMS,
  ART,
  albumSrc,
  albumsByArtist,
  artSrc,
  dailySeed,
  formatPostDate,
  paginate,
  seededShuffle,
  sortPostsNewestFirst,
  type Album,
} from './room';
import { loadRoomPosts } from './room-posts';
import { listNoteSlugs, loadNote } from './notes';

const PUBLIC = path.join(process.cwd(), 'public');
const inPublic = (src: string) => existsSync(path.join(PUBLIC, src));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('room data', () => {
  it('has 33 art pieces with unique ids and exactly one window view', () => {
    expect(ART).toHaveLength(33);
    expect(new Set(ART.map((a) => a.id)).size).toBe(33);
    expect(ART.filter((a) => a.role === 'window-view')).toHaveLength(1);
  });

  it('has 90 albums with unique ids, two of them without a cover', () => {
    expect(ALBUMS).toHaveLength(90);
    expect(new Set(ALBUMS.map((a) => a.id)).size).toBe(90);
    expect(ALBUMS.filter((a) => !a.hasCover)).toHaveLength(2);
  });

  it('has both image sizes on disk and a positive size for every art piece', () => {
    for (const a of ART) {
      expect(inPublic(artSrc(a.id, 'wall')), a.id).toBe(true);
      expect(inPublic(artSrc(a.id, 'full')), a.id).toBe(true);
      expect(a.width).toBeGreaterThan(0);
      expect(a.height).toBeGreaterThan(0);
    }
  });

  it('has both image sizes on disk and a positive size for every album cover', () => {
    for (const a of ALBUMS.filter((x) => x.hasCover)) {
      expect(inPublic(albumSrc(a.id, 'wall')), a.id).toBe(true);
      expect(inPublic(albumSrc(a.id, 'full')), a.id).toBe(true);
      expect(a.width).toBeGreaterThan(0);
      expect(a.height).toBeGreaterThan(0);
    }
  });
});

describe('room helpers', () => {
  it('formats a post date in UTC', () => {
    expect(formatPostDate('2026-10-18')).toBe('Oct 18, 2026');
    expect(formatPostDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatPostDate('2025-12-31')).toBe('Dec 31, 2025');
  });

  it('paginates into pages of six', () => {
    expect(paginate([])).toEqual([]);
    expect(paginate(range(6)).map((p) => p.length)).toEqual([6]);
    expect(paginate(range(7)).map((p) => p.length)).toEqual([6, 1]);
    expect(paginate(range(13)).map((p) => p.length)).toEqual([6, 6, 1]);
    expect(paginate(range(13)).flat()).toEqual(range(13));
  });

  it('sorts posts newest first without mutating the input', () => {
    const posts = [{ date: '2026-01-02' }, { date: '2026-10-18' }, { date: '2025-05-05' }];
    const copy = [...posts];
    expect(sortPostsNewestFirst(posts).map((p) => p.date)).toEqual(['2026-10-18', '2026-01-02', '2025-05-05']);
    expect(posts).toEqual(copy);
  });

  it('shuffles deterministically by seed', () => {
    const items = range(30);
    const a = seededShuffle(items, 42);
    expect(seededShuffle(items, 42)).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(items).toEqual(range(30));
    expect(seededShuffle(items, 43)).not.toEqual(a);
  });

  it('gives one seed per local calendar day', () => {
    const morning = new Date(2026, 10, 22, 8, 0);
    const evening = new Date(2026, 10, 22, 23, 30);
    const nextDay = new Date(2026, 10, 23, 0, 5);
    expect(dailySeed(morning)).toBe(dailySeed(evening));
    expect(dailySeed(nextDay)).not.toBe(dailySeed(morning));
    expect(Number.isInteger(dailySeed(morning))).toBe(true);
  });

  it('orders albums by artist, ignoring case and a leading "The ", then by year', () => {
    const mk = (artist: string, year: string): Album => ({
      id: `${artist}-${year}`, artist, title: 't', year, type: 'Album', width: 1, height: 1, hasCover: true,
    });
    const sorted = albumsByArtist([
      mk('The Zombies', '1968'),
      mk('beatles', '1969'),
      mk('Aphex Twin', '1994'),
      mk('Aphex Twin', '1992'),
      mk('The Cure', '1985'),
    ]);
    expect(sorted.map((a) => a.id)).toEqual([
      'Aphex Twin-1992', 'Aphex Twin-1994', 'beatles-1969', 'The Cure-1985', 'The Zombies-1968',
    ]);
  });
});

describe('loadRoomPosts', () => {
  it('returns every dated note, newest first, linked under /notes/', async () => {
    const dated: string[] = [];
    for (const slug of await listNoteSlugs()) {
      if ((await loadNote(slug)).date) dated.push(`/notes/${slug}`);
    }
    expect(dated.length).toBeGreaterThan(0);
    const posts = await loadRoomPosts();
    expect(posts.map((p) => p.href).sort()).toEqual([...dated].sort());
    for (const p of posts) {
      expect(p.href.startsWith('/notes/')).toBe(true);
      expect(p.dateLabel).toBe(formatPostDate(p.date));
    }
    const dates = posts.map((p) => p.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
