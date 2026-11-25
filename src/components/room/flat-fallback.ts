// When WebGL is not there, the room page turns into the flat page that phones
// get: the @media rule in room.css whose condition is FLAT_MEDIA and which
// holds the .gp-flat rules is made to apply everywhere, through the CSSOM.
// The two narrower refinement rules (small phones, short landscape screens)
// keep their own conditions. Works on the minified production CSS as well:
// conditions are compared with whitespace removed and the max-width / range
// spellings treated as the same.

import { FLAT_MEDIA } from './behaviour';

// The parts of CSSRule, CSSMediaRule and CSSStyleSheet read here, so tests can
// pass plain objects.
export type RuleLike = {
  media?: { mediaText: string };
  selectorText?: string;
  cssRules?: ArrayLike<RuleLike>;
};
export type SheetLike = { cssRules: ArrayLike<RuleLike> };

// One spelling for a media condition: no whitespace, lower case, and
// `(max-width:Npx)` written as `(width<=Npx)` (minifiers may use either).
export function normalizeMedia(text: string): string {
  return text
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/\(max-width:([^)]+)\)/g, '(width<=$1)');
}

function rulesOf(r: { cssRules?: ArrayLike<RuleLike> }): RuleLike[] {
  try {
    return r.cssRules ? Array.from(r.cssRules) : [];
  } catch {
    // A cross-origin sheet throws on cssRules.
    return [];
  }
}

function hasFlatSelector(rule: RuleLike): boolean {
  return rulesOf(rule).some((r) => /\.gp-flat(?![\w-])/.test(r.selectorText ?? '') || hasFlatSelector(r));
}

// Whether `rule` is the flat page's @media rule.
export function isFlatRule(rule: RuleLike, query: string = FLAT_MEDIA): boolean {
  let text: string;
  try {
    text = rule.media?.mediaText ?? '';
  } catch {
    return false;
  }
  return text !== '' && normalizeMedia(text) === normalizeMedia(query) && hasFlatSelector(rule);
}

// Every flat page @media rule in the sheets, including ones nested in other
// grouping rules (@layer, @supports).
export function findFlatRules(sheets: ArrayLike<SheetLike>, query: string = FLAT_MEDIA): RuleLike[] {
  const out: RuleLike[] = [];
  const walk = (rules: RuleLike[]) => {
    for (const r of rules) {
      if (isFlatRule(r, query)) out.push(r);
      else walk(rulesOf(r));
    }
  };
  let list: SheetLike[] = [];
  try {
    list = Array.from(sheets);
  } catch {
    list = [];
  }
  for (const s of list) walk(rulesOf(s));
  return out;
}

// Makes the flat page apply at every size. Returns how many rules it changed.
export function forceFlatPage(doc: { styleSheets: ArrayLike<SheetLike> } = document as unknown as { styleSheets: ArrayLike<SheetLike> }): number {
  let n = 0;
  for (const rule of findFlatRules(doc.styleSheets)) {
    try {
      rule.media!.mediaText = 'all';
      n++;
    } catch {
      // Read-only rule: leave it.
    }
  }
  return n;
}
