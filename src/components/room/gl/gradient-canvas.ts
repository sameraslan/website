// Paints CSS gradient layers (paint.ts `Gradient`) onto a 2D canvas, with CSS
// semantics: lengths against the box (the padding box of the quad), linear
// gradient lines sized as CSS sizes them for an angle, ellipse radial
// gradients, repeating-linear-gradient, hard stops, stops without a position
// spread evenly, and the last layer drawn first. No ctx.filter (Safari lacks
// it). The renderer uploads the canvas as a texture laid over the padding box.

import type { Color, Gradient, Len, Stop } from './paint';

type Resolved = { pos: number; color: Color };

const css = ([r, g, b, a]: Color) => `rgba(${r}, ${g}, ${b}, ${a})`;

// Stops as positions along the gradient line (0 to 1 = start to end; may lie
// outside) following CSS: two positions make two stops, a missing first or
// last position is 0 or 1, positions never go backwards, and stops without a
// position are spread evenly between their positioned neighbours.
export function resolveStops(stops: Stop[], lineLength: number): Resolved[] {
  const toPos = (l: Len) => ('px' in l ? l.px / lineLength : l.pct / 100);
  const flat: { pos: number | null; color: Color }[] = [];
  for (const s of stops) {
    if (s.at.length === 0) flat.push({ pos: null, color: s.color });
    for (const l of s.at) flat.push({ pos: toPos(l), color: s.color });
  }
  if (flat.length === 0) return [];
  if (flat[0].pos === null) flat[0].pos = 0;
  if (flat[flat.length - 1].pos === null) flat[flat.length - 1].pos = 1;
  let max = -Infinity;
  for (const f of flat) {
    if (f.pos !== null) {
      max = Math.max(max, f.pos);
      f.pos = max;
    }
  }
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].pos !== null) continue;
    let j = i;
    while (flat[j].pos === null) j++;
    const a = flat[i - 1].pos as number;
    const b = flat[j].pos as number;
    for (let k = i; k < j; k++) flat[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return flat.map((f) => ({ pos: f.pos as number, color: f.color }));
}

// The colour at t on the stop list (premultiplied interpolation, as CSS does).
function colorAt(stops: Resolved[], t: number): Color {
  if (t <= stops[0].pos) return stops[0].color;
  const last = stops[stops.length - 1];
  if (t >= last.pos) return last.color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.pos && t <= b.pos && b.pos > a.pos) {
      const f = (t - a.pos) / (b.pos - a.pos);
      const pa = a.color[3];
      const pb = b.color[3];
      const alpha = pa + (pb - pa) * f;
      const ch = (k: number) => (alpha > 0 ? (a.color[k] * pa + (b.color[k] * pb - a.color[k] * pa) * f) / alpha : a.color[k] + (b.color[k] - a.color[k]) * f);
      return [ch(0), ch(1), ch(2), alpha];
    }
  }
  return last.color;
}

// Canvas stops in [0, 1]: repeats a repeating gradient over the line, and
// cuts the list at 0 and 1 with the colours there.
function canvasStops(stops: Resolved[], repeating: boolean): Resolved[] {
  let list = stops;
  if (repeating) {
    const first = stops[0].pos;
    const period = stops[stops.length - 1].pos - first;
    if (period > 1e-6) {
      list = [];
      const n0 = Math.floor((0 - stops[stops.length - 1].pos) / period);
      for (let n = n0; first + n * period <= 1; n++) for (const s of stops) list.push({ pos: s.pos + n * period, color: s.color });
    }
  }
  const out: Resolved[] = [{ pos: 0, color: colorAt(list, 0) }];
  for (const s of list) if (s.pos > 0 && s.pos < 1) out.push(s);
  out.push({ pos: 1, color: colorAt(list, 1 - 1e-9) });
  return out;
}

const lenOf = (l: Len, ref: number) => ('px' in l ? l.px : (l.pct / 100) * ref);

function paintLayer(ctx: CanvasRenderingContext2D, g: Gradient, w: number, h: number) {
  if (g.kind === 'linear') {
    const a = (g.angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const L = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = w / 2;
    const cy = h / 2;
    const grad = ctx.createLinearGradient(cx - (dx * L) / 2, cy - (dy * L) / 2, cx + (dx * L) / 2, cy + (dy * L) / 2);
    for (const s of canvasStops(resolveStops(g.stops, L), g.repeating)) grad.addColorStop(s.pos, css(s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const rx = Math.max(lenOf(g.rx, w), 1e-3);
  const ry = Math.max(lenOf(g.ry, h), 1e-3);
  const cx = lenOf(g.cx, w);
  const cy = lenOf(g.cy, h);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const s of canvasStops(resolveStops(g.stops, rx), false)) grad.addColorStop(s.pos, css(s.color));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = grad;
  const k = rx / ry;
  ctx.fillRect(-cx, -cy * k, w, h * k);
  ctx.restore();
}

// Whether a gradient list has hard edges (bands, stripes), which need more
// than one canvas pixel per CSS px to stay crisp.
export function isHardEdged(layers: Gradient[]): boolean {
  return layers.some(
    (g) =>
      (g.kind === 'linear' && g.repeating) ||
      g.stops.some((s, i) => s.at.length === 2 || (i > 0 && s.at.length > 0 && g.stops[i - 1].at.length > 0 && JSON.stringify(s.at[0]) === JSON.stringify(g.stops[i - 1].at.at(-1))))
  );
}

// Canvas px per CSS px: 2 for hard-edged or small boxes, 0.5 for smooth ones.
export function gradientScale(layers: Gradient[], w: number, h: number): number {
  return isHardEdged(layers) || w * h < 20000 ? 2 : 0.5;
}

const MAX_SIDE = 4096;

// A canvas holding the layers over a w x h box, at `scale` canvas px per CSS px.
export function paintGradients(layers: Gradient[], w: number, h: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.min(MAX_SIDE, Math.round(w * scale)));
  canvas.height = Math.max(1, Math.min(MAX_SIDE, Math.round(h * scale)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(canvas.width / w, canvas.height / h);
  for (let i = layers.length - 1; i >= 0; i--) paintLayer(ctx, layers[i], w, h);
  return canvas;
}
