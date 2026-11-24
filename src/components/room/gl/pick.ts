// Picking: the ray through a viewport point against every quad that takes the
// pointer; the nearest hit wins. A 'solid' quad blocks without a target.
// Pure: no DOM, no three.js.

import type { Camera } from './camera';
import { multiply, type Mat4 } from './mat4';
import type { Quad, Target } from './scene';

export type Hit = { quad: Quad; u: number; v: number; depth: number };

// Where the ray through viewport (x, y) meets quad space z = 0 of the clip
// matrix M (quad px to clip): local (u, v) and the view distance there.
function hitQuad(M: Mat4, nx: number, ny: number): { u: number; v: number; d: number } | null {
  // Row r of M on (u, v, 0, 1): M[r], M[4 + r], M[12 + r].
  const row = (r: number) => [M[r], M[4 + r], M[12 + r]];
  const X = row(0);
  const Y = row(1);
  const W = row(3);
  const a = [X[0] - nx * W[0], X[1] - nx * W[1], X[2] - nx * W[2]];
  const b = [Y[0] - ny * W[0], Y[1] - ny * W[1], Y[2] - ny * W[2]];
  const det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-12) return null;
  const u = (-a[2] * b[1] + a[1] * b[2]) / det;
  const v = (-a[0] * b[2] + a[2] * b[0]) / det;
  const d = W[0] * u + W[1] * v + W[2];
  return { u, v, d };
}

export function hitTest(quads: Quad[], camera: Camera, x: number, y: number, hovered?: string | null): Hit | null {
  const { root } = camera;
  const nx = ((x - root.left) / root.width) * 2 - 1;
  const ny = 1 - ((y - root.top) / root.height) * 2;
  let best: Hit | null = null;
  for (const q of quads) {
    if (q.pick === 'none' || q.layer !== 'room') continue;
    const world = hovered && q.key === hovered && q.picture ? q.picture.hoverMatrix : q.matrix;
    const h = hitQuad(multiply(camera.clip, world), nx, ny);
    if (!h || h.d <= 0) continue;
    if (h.u < 0 || h.v < 0 || h.u > q.w || h.v > q.h) continue;
    if (!best || h.d < best.depth) best = { quad: q, u: h.u, v: h.v, depth: h.d };
  }
  return best;
}

// The target under viewport point (x, y), or null (nothing, or a solid surface).
// `hovered`: key of the picture currently lifted by hover.
export function pick(quads: Quad[], camera: Camera, x: number, y: number, hovered?: string | null): Target | null {
  const h = hitTest(quads, camera, x, y, hovered);
  if (!h || h.quad.pick === 'solid' || h.quad.pick === 'none') return null;
  return h.quad.pick;
}
