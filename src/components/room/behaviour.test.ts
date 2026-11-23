import { describe, it, expect } from 'vitest';
import { IDLE_MS, SCALE_EXPR, SCALE_SCRIPT, escapeStep, pickDailyAlbums, shouldStartTour, stageScale, type IdleState } from './behaviour';

describe('stageScale', () => {
  it('cover-scales the 1280 x 900 stage at ordinary sizes', () => {
    expect(stageScale(1440, 900)).toBeCloseTo(1.125);
    expect(stageScale(1506, 812)).toBeCloseTo(1506 / 1280);
    expect(stageScale(1920, 1080)).toBeCloseTo(1.5);
    expect(stageScale(1280, 720)).toBeCloseTo(1);
  });

  it('caps the scale in very wide windows so the board stays in view', () => {
    expect(stageScale(2560, 1080)).toBeLessThan(2560 / 1280);
    expect(stageScale(3440, 1440)).toBeLessThan(3440 / 1280);
    // The capped scale still covers the width: the room draws past the stage box.
    expect(stageScale(2560, 1080)).toBeGreaterThan(1080 / 900);
  });

  it('falls back to 1 for an empty size', () => {
    expect(stageScale(0, 900)).toBe(1);
    expect(stageScale(1440, 0)).toBe(1);
  });

  it('matches the expression used by the inline script', () => {
    const expr = new Function('w', 'h', `return ${SCALE_EXPR}`) as (w: number, h: number) => number;
    for (const [w, h] of [
      [1440, 900],
      [1506, 812],
      [2560, 1080],
      [3440, 1440],
      [800, 1200],
    ]) {
      expect(expr(w, h)).toBeCloseTo(stageScale(w, h), 10);
    }
  });

  it('sets --rs-scale on the script parent from the viewport size', () => {
    const root = document.createElement('div');
    const fakeDocument = { currentScript: { parentNode: root } };
    const fakeWindow = { innerWidth: 2560, innerHeight: 1080 };
    // Only the window size is available here (jsdom has no layout), as in a very early paint.
    root.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    new Function('document', 'window', SCALE_SCRIPT)(fakeDocument, fakeWindow);
    expect(Number(root.style.getPropertyValue('--rs-scale'))).toBeCloseTo(stageScale(2560, 1080), 10);
  });
});

describe('shouldStartTour', () => {
  const base: IdleState = {
    auto: true,
    mode: 'read',
    idleMs: IDLE_MS + 500,
    overBoard: false,
    boardFocused: false,
    focusOpen: false,
    crateOpen: false,
    hidden: false,
  };

  it('starts the tour after 10 idle seconds in reading mode', () => {
    expect(shouldStartTour(base)).toBe(true);
    expect(shouldStartTour({ ...base, idleMs: IDLE_MS - 1 })).toBe(false);
  });

  it('holds while anything blocks it', () => {
    expect(shouldStartTour({ ...base, auto: false })).toBe(false);
    expect(shouldStartTour({ ...base, mode: 'explore' })).toBe(false);
    expect(shouldStartTour({ ...base, overBoard: true })).toBe(false);
    // A keyboard user reading a focused post on the board keeps reading mode.
    expect(shouldStartTour({ ...base, boardFocused: true })).toBe(false);
    expect(shouldStartTour({ ...base, focusOpen: true })).toBe(false);
    expect(shouldStartTour({ ...base, crateOpen: true })).toBe(false);
    expect(shouldStartTour({ ...base, hidden: true })).toBe(false);
  });
});

describe('escapeStep', () => {
  it('closes the focused view first, then the crate, then leaves the tour', () => {
    expect(escapeStep({ focusOpen: true, crateOpen: true, mode: 'explore' })).toBe('close-focus');
    expect(escapeStep({ focusOpen: false, crateOpen: true, mode: 'explore' })).toBe('close-crate');
    expect(escapeStep({ focusOpen: false, crateOpen: false, mode: 'explore' })).toBe('to-read');
    expect(escapeStep({ focusOpen: false, crateOpen: false, mode: 'read' })).toBe('none');
  });
});

describe('pickDailyAlbums', () => {
  const day = new Date(2026, 10, 23, 9);

  it('picks 19 distinct albums, all with a cover', () => {
    const list = pickDailyAlbums(day);
    expect(list).toHaveLength(19);
    expect(new Set(list.map((a) => a.id)).size).toBe(19);
    expect(list.every((a) => a.hasCover)).toBe(true);
  });

  it('gives the same list all day and a different order on another day', () => {
    const ids = (d: Date) => pickDailyAlbums(d).map((a) => a.id);
    expect(ids(new Date(2026, 10, 23, 22))).toEqual(ids(day));
    expect(ids(new Date(2026, 10, 24, 9))).not.toEqual(ids(day));
  });
});
