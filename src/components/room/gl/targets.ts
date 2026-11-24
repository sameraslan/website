// Links between the scene's interactive targets and the DOM that stands in
// for them: which quad a target's focus ring and caption follow, where its
// caption sits, and the screen box a keyboard proxy takes. Pure: no DOM.

import type { Camera } from './camera';
import { apply, type Mat4 } from './mat4';
import type { Caption, Quad, Scene, Target } from './scene';
import { targetId } from '../pieces';

// The quad that stands for each target: the picture itself, or the first
// crate's front face for the crate.
export function targetQuads(scene: Scene): Map<string, Quad> {
  const out = new Map<string, Quad>();
  for (const q of scene.quads) {
    if (q.pick === 'none' || q.pick === 'solid' || q.layer !== 'room') continue;
    const id = targetId(q.pick);
    if (!out.has(id)) out.set(id, q);
  }
  return out;
}

// Index into scene.crateCaptions of the crate a quad belongs to (its faces are
// keyed crate1:n, crate2:n in caption order), or -1.
export function crateIndex(key: string): number {
  const m = /^crate(\d+):/.exec(key);
  return m ? Number(m[1]) - 1 : -1;
}

const num = (x: number) => +x.toFixed(6);

// CSS transform that puts a caption box, positioned at the top-left of an
// element inside .rs-room with transform-origin 0 0, at its anchor in the
// frame `matrix`: right-aligned boxes end at the anchor, bottom-anchored ones
// sit on it.
export function captionTransform(matrix: Mat4, c: Caption): string {
  const shift = `${c.align === 'right' ? '-100%' : '0'}, ${c.anchor === 'bottom' ? '-100%' : '0'}`;
  return `matrix3d(${matrix.map(num).join(', ')}) translate(${num(c.x)}px, ${num(c.y)}px) translate(${shift})`;
}

export type Box = { left: number; top: number; width: number; height: number };

// Screen bounding box of a w x h quad drawn with world `matrix`, relative to
// the camera's root rect.
export function projectedBox(camera: Camera, matrix: Mat4, w: number, h: number): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [u, v] of [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]) {
    const [x, y, z, k] = apply(matrix, [u, v, 0]);
    const [sx, sy] = camera.project([x / k, y / k, z / k]);
    xs.push(sx - camera.root.left);
    ys.push(sy - camera.root.top);
  }
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

// `box` cut to the 0..width x 0..height area. A box with less than 1 px
// inside it becomes a 1 x 1 box at the nearest point inside.
export function clampBox(box: Box, width: number, height: number): Box {
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  const right = Math.min(width, box.left + box.width);
  const bottom = Math.min(height, box.top + box.height);
  if (right - left >= 1 && bottom - top >= 1) return { left, top, width: right - left, height: bottom - top };
  const x = Math.min(Math.max(0, left), Math.max(0, width - 1));
  const y = Math.min(Math.max(0, top), Math.max(0, height - 1));
  return { left: x, top: y, width: 1, height: 1 };
}

export const sameTarget = (a: Target | null, b: Target | null) => (a && b ? targetId(a) === targetId(b) : a === b);
