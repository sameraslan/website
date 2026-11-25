import { describe, expect, it } from 'vitest';
import { FLAT_MEDIA } from './behaviour';
import { findFlatRules, forceFlatPage, isFlatRule, normalizeMedia, type RuleLike, type SheetLike } from './flat-fallback';

const style = (selectorText: string): RuleLike => ({ selectorText });
const media = (mediaText: string, rules: RuleLike[]): RuleLike => ({ media: { mediaText }, cssRules: rules });

describe('normalizeMedia', () => {
  it('ignores whitespace and case, and reads max-width as a range', () => {
    expect(normalizeMedia('(max-width: 760px), (pointer: coarse)')).toBe(normalizeMedia('(max-width:760px),(pointer:coarse)'));
    expect(normalizeMedia('(MAX-WIDTH: 760px), (pointer: coarse)')).toBe(normalizeMedia('(width <= 760px), (pointer: coarse)'));
    expect(normalizeMedia('(max-width: 479px)')).not.toBe(normalizeMedia(FLAT_MEDIA));
  });
});

describe('isFlatRule', () => {
  it('matches the flat query when the rule holds a .gp-flat selector', () => {
    expect(isFlatRule(media('(max-width: 760px), (pointer: coarse)', [style('.rs-root'), style('.rs-root .gp-flat .gp-board')]))).toBe(true);
    expect(isFlatRule(media('(max-width:760px),(pointer:coarse)', [style('.rs-root .gp-flat')]))).toBe(true);
  });

  it('leaves the refinement rules and look-alikes alone', () => {
    expect(isFlatRule(media('(max-width: 479px)', [style('.rs-root .gp-flat .gp-bd-title')]))).toBe(false);
    expect(isFlatRule(media('(max-height: 500px) and (max-width: 760px)', [style('.rs-root .gp-fx-img')]))).toBe(false);
    expect(isFlatRule(media(FLAT_MEDIA, [style('.site-nav')]))).toBe(false);
    expect(isFlatRule(media(FLAT_MEDIA, [style('.rs-root .gp-flat-crate')]))).toBe(false);
    expect(isFlatRule(style('.rs-root .gp-flat'))).toBe(false);
  });
});

describe('forceFlatPage', () => {
  it('sets the flat rule to all, also inside @layer, and skips sheets that throw', () => {
    const flat = media(FLAT_MEDIA, [style('.rs-root .gp-flat')]);
    const nested = media('(max-width: 760px), (pointer: coarse)', [style('.gp-flat')]);
    const small = media('(max-width: 479px)', [style('.rs-root .gp-flat .gp-bd-title')]);
    const crossOrigin = {
      get cssRules(): ArrayLike<RuleLike> {
        throw new DOMException('cross-origin', 'SecurityError');
      },
    };
    const sheets: SheetLike[] = [crossOrigin, { cssRules: [style('body'), flat, small] }, { cssRules: [{ cssRules: [nested] }] }];
    expect(findFlatRules(sheets)).toEqual([flat, nested]);
    expect(forceFlatPage({ styleSheets: sheets })).toBe(2);
    expect(flat.media!.mediaText).toBe('all');
    expect(nested.media!.mediaText).toBe('all');
    expect(small.media!.mediaText).toBe('(max-width: 479px)');
  });
});
