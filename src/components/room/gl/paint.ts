// What a quad of the room draws, as plain data: everything a renderer needs,
// nothing it must look up in CSS. Lengths are CSS px of the quad's own box
// (y down, origin at the border box's top-left). Backgrounds (textures and
// gradients) are laid out in the padding box (inside the border), as CSS
// background-origin does; borders paint over them.

export type Color = [number, number, number, number]; // r, g, b in 0-255, alpha in 0-1

// A CSS length as written: px, or a percentage of the box (or gradient line).
export type Len = { px: number } | { pct: number };

// A colour stop as written in CSS: no position, one, or two (a hard band).
export type Stop = { color: Color; at: Len[] };

export type Gradient =
  // angle: CSS gradient angle in deg (180 = top to bottom, 90 = left to right).
  | { kind: 'linear'; angle: number; repeating: boolean; stops: Stop[] }
  // An ellipse: radii and centre as written (percentages of the padding box).
  | { kind: 'radial'; rx: Len; ry: Len; cx: Len; cy: Len; stops: Stop[] };

export type Shadow = { x: number; y: number; blur: number; spread: number; color: Color; inset: boolean };

// Widths and colours in CSS order: top, right, bottom, left.
export type Border = { width: [number, number, number, number]; color: [Color, Color, Color, Color] };

export type Fill =
  | { kind: 'none' }
  | { kind: 'solid'; color: Color }
  // A repeating texture at `size` (CSS background-size), offset by `position`
  // (background-position), times `tint` (background-blend-mode: multiply with
  // a flat colour; null for none), then the flat `overlays` and the
  // `gradients` painted over it (last in the list drawn first, as in CSS).
  // `fallback` is the background-color, shown until the texture has loaded.
  | {
      kind: 'tiled';
      texture: string;
      size: [number, number];
      position: [number, number];
      tint: Color | null;
      overlays: Color[];
      gradients: Gradient[];
      fallback: Color;
    }
  // Gradient layers, first in the list on top (CSS order).
  | { kind: 'gradient'; layers: Gradient[] }
  // Flat rectangles [x, y, w, h] of one colour (the light shafts).
  | { kind: 'rects'; color: Color; rects: [number, number, number, number][] }
  // A whole image filling the box. A mirrored image is mirrored by the quad's
  // matrix already (CSS scaleX(-1)): sample it with plain uv.
  | { kind: 'image'; src: string; filter: Filter | null; mirroredByMatrix: boolean }
  | PictureFill
  // Drawn by the DOM layer, not the canvas (letter board, chains).
  | { kind: 'dom'; element: 'board' | 'chain' };

export type Filter = { brightness: number; saturate: number };

export type PictureSource =
  | { kind: 'art'; id: string; src: string }
  // slot: index into the daily album list; id and src null when no album is known.
  | { kind: 'album'; slot: number; id: string | null; src: string | null };

// A hung picture: mat colour (the figure's background, null when none) under
// the image rect [x, y, w, h]; an album sleeve is a `sleeve.color` rect behind
// the cover, which fades in over `sleeve.fadeIn` s once loaded.
export type PictureFill = {
  kind: 'picture';
  source: PictureSource;
  mat: Color | null;
  image: [number, number, number, number];
  sleeve: { rect: [number, number, number, number]; color: Color; fadeIn: number } | null;
  filter: Filter | null;
};

export type Paint = {
  fill: Fill;
  border?: Border;
  radius?: number;
  // CSS box-shadow list, first on top.
  shadows?: Shadow[];
  // CSS outline (width, offset from the border box, colour).
  outline?: { width: number; offset: number; color: Color };
  // filter: blur(), in px (a Gaussian of sigma = blur).
  blur?: number;
};

// --- CSS value parsers (the subset the room uses).

const NAMED: Record<string, Color> = { transparent: [0, 0, 0, 0] };

export function parseColor(s: string): Color {
  const t = s.trim().toLowerCase();
  if (NAMED[t]) return NAMED[t];
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), 1];
  }
  const m = /^rgba?\(([^)]*)\)$/.exec(t);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`Unsupported colour: ${s}`);
}

// Splits at top-level separators (commas or whitespace), outside parentheses.
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && sep.test(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseLen(s: string): Len {
  if (s.endsWith('%')) return { pct: parseFloat(s) };
  if (s.endsWith('px') || s === '0') return { px: parseFloat(s) };
  throw new Error(`Unsupported length: ${s}`);
}

function parseStop(s: string): Stop {
  const parts = splitTop(s, /\s/);
  return { color: parseColor(parts[0]), at: parts.slice(1).map(parseLen) };
}

// A CSS background-image list of gradients (no url() layers).
export function parseGradients(css: string): Gradient[] {
  return splitTop(css, /,/).map((layer) => {
    const m = /^(repeating-linear-gradient|linear-gradient|radial-gradient)\((.*)\)$/s.exec(layer.trim());
    if (!m) throw new Error(`Unsupported background layer: ${layer}`);
    const args = splitTop(m[2], /,/);
    if (m[1] === 'radial-gradient') {
      const g = /^ellipse\s+(\S+)\s+(\S+)\s+at\s+(\S+)\s+(\S+)$/.exec(args[0]);
      if (!g) throw new Error(`Unsupported radial gradient: ${args[0]}`);
      return { kind: 'radial', rx: parseLen(g[1]), ry: parseLen(g[2]), cx: parseLen(g[3]), cy: parseLen(g[4]), stops: args.slice(1).map(parseStop) };
    }
    const hasAngle = /deg$/.test(args[0]);
    return {
      kind: 'linear',
      angle: hasAngle ? parseFloat(args[0]) : 180,
      repeating: m[1] === 'repeating-linear-gradient',
      stops: (hasAngle ? args.slice(1) : args).map(parseStop),
    };
  });
}

// A CSS box-shadow list.
export function parseShadows(css: string): Shadow[] {
  return splitTop(css, /,/).map((one) => {
    const parts = splitTop(one, /\s/);
    const inset = parts.includes('inset');
    const rest = parts.filter((p) => p !== 'inset');
    const colorAt = rest.findIndex((p) => p.startsWith('#') || p.startsWith('rgb'));
    const color = parseColor(rest[colorAt]);
    const n = rest.filter((_, i) => i !== colorAt).map((p) => parseFloat(p));
    return { x: n[0], y: n[1], blur: n[2] ?? 0, spread: n[3] ?? 0, color, inset };
  });
}

export function uniformBorder(width: number, color: string): Border {
  const c = parseColor(color);
  return { width: [width, width, width, width], color: [c, c, c, c] };
}
