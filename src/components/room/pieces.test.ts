import { describe, expect, it } from 'vitest';
import { ART } from '@/lib/room';
import { CRATE_OPEN_LABEL, CRATE_TITLE } from './copy';
import { pickDailyAlbums } from './behaviour';
import { WINDOW_VIEW_ID } from './layout';
import { captionText, describeTarget, targetId } from './pieces';

describe('describeTarget', () => {
  const albums = pickDailyAlbums(new Date(2026, 10, 24));

  it('names a painting by its caption and opens it', () => {
    const a = ART.find((x) => x.role === 'wall')!;
    const info = describeTarget({ kind: 'art', id: a.id }, albums);
    expect(info).toMatchObject({ kind: 'piece', label: `${a.artist}, ${a.title}, ${a.year}`, caption: captionText(a) });
    expect(info?.kind === 'piece' && info.piece.title).toBe(a.title);
  });

  it('opens the window view as its painting', () => {
    const info = describeTarget({ kind: 'view' }, albums);
    expect(info?.kind === 'piece' && info.piece.title).toBe(ART.find((x) => x.id === WINDOW_VIEW_ID)!.title);
  });

  it('describes an album slot from the daily list, and nothing for an empty slot', () => {
    const info = describeTarget({ kind: 'album', slot: 0 }, albums);
    expect(info?.caption).toBe(captionText(albums[0]));
    expect(describeTarget({ kind: 'album', slot: 0 }, null)).toBeNull();
  });

  it('labels the crate with the open label and captions it with its title', () => {
    expect(describeTarget({ kind: 'crate' }, null)).toEqual({ kind: 'crate', label: CRATE_OPEN_LABEL, caption: CRATE_TITLE });
  });

  it('gives each target a distinct id', () => {
    const ids = [targetId({ kind: 'view' }), targetId({ kind: 'crate' }), targetId({ kind: 'art', id: 'x' }), targetId({ kind: 'album', slot: 3 })];
    expect(new Set(ids).size).toBe(4);
  });
});
