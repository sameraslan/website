import { describe, it, expect } from 'vitest';
import { ART } from '@/lib/room';
import { ALBUM_SLOT_COUNT, HANGING, PLANE_ORDER, STRIP_ART_IDS, WINDOW_VIEW_ID } from './layout';

describe('the art strip order', () => {
  it('holds every art entry once, in hanging order, with the window view last', () => {
    expect(STRIP_ART_IDS).toHaveLength(ART.length);
    expect(new Set(STRIP_ART_IDS)).toEqual(new Set(ART.map((a) => a.id)));
    expect(STRIP_ART_IDS[STRIP_ART_IDS.length - 1]).toBe(WINDOW_VIEW_ID);
    expect(STRIP_ART_IDS[0]).toBe('gauguin-mahana-no-atua');
  });
});

describe('the hanging plan', () => {
  const slots = PLANE_ORDER.flatMap((p) => HANGING[p]);
  const artIds = slots.flatMap((s) => (s.kind === 'art' ? [s.id] : []));

  it('has exactly 19 album slots and 32 art slots', () => {
    expect(ALBUM_SLOT_COUNT).toBe(19);
    expect(slots.filter((s) => s.kind === 'album')).toHaveLength(19);
    expect(artIds).toHaveLength(32);
  });

  it('hangs every art slot from ART, none twice, leaving out only the window view', () => {
    const known = new Set(ART.map((a) => a.id));
    for (const id of artIds) expect(known.has(id)).toBe(true);
    expect(new Set(artIds).size).toBe(artIds.length);
    expect(ART.map((a) => a.id).filter((id) => !artIds.includes(id))).toEqual([WINDOW_VIEW_ID]);
  });
});
