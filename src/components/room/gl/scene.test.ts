// The scene description against the CSS 3D room it replaced. The fixture
// gl/__fixtures__/dom-quads.json was dumped from that DOM room at commit
// 60e00cc, before the DOM room was removed: the projected corners of every box
// at two camera poses, the hover lift and caption start of every picture, and
// what elementFromPoint hit at each picture centre. Every box has exactly one
// quad with the same projected corners at both poses, and back.

import { describe, expect, it } from 'vitest';
import { ALBUMS } from '@/lib/room';
import { HANGING, PLANE_ORDER } from '../layout';
import fixture from './__fixtures__/dom-quads.json';
import { clipToViewport, makeCamera, rigFromCss, rigFromNumbers, type Camera, type Rig } from './camera';
import { apply, type Mat4, type Vec3 } from './mat4';
import { hitTest, pick } from './pick';
import { buildScene, type Quad, type Target } from './scene';

type Pt = [number, number];
type FBox = { tag: string; cls: string; ctx: string | null; stage: string; i: number; w: number; h: number; A: Pt[]; B: Pt[] };
type FPose = { mode: string; root: { left: number; top: number; width: number; height: number }; scale: number; rig: { dolly: string; sway: string; cam: string } };
type FPic = { box: number; centre: Pt; hit: string | { fig: number } | { other: string | null }; hover: Pt[] | null; hoverBy: string; cap: { tl: Pt; tr: Pt; right: boolean } | null };

const F = fixture as unknown as { albums: (string | null)[]; poses: { A: FPose; B: FPose }; boxes: FBox[]; pictures: FPic[] };
const TOL = 0.75;
// Picture heights come from the width and height in the art and album data,
// while the DOM room used the wall-size image files' pixel sizes; the two
// aspects differ by a fraction of a pixel at hanging size. Pictures (and the
// captions hung below them) get 1 px: the framed pieces and the window view.
const PIC_TOL = 1;
const isPic = (b: { tag: string; cls: string; ctx: string | null }) =>
  (b.tag === 'figure' && b.cls.split(' ').includes('rs-pc')) || (b.tag === 'img' && (b.ctx ?? '').split(' ').includes('rw-view'));
const tolOf = (b: FBox) => (isPic(b) ? PIC_TOL : TOL);

const albums = F.albums.map((id) => (id ? (ALBUMS.find((a) => a.id === id) ?? null) : null));
const cameraOf = (p: FPose) => makeCamera(rigFromCss(p.rig), p.scale, p.root);
const camA = cameraOf(F.poses.A);
const camB = cameraOf(F.poses.B);
const sceneA = buildScene({ albums, mode: 'read' });
const sceneB = buildScene({ albums, mode: 'explore' });

const corners = (q: { w: number; h: number }, m: Mat4, cam: Camera): Pt[] =>
  ([[0, 0, 0], [q.w, 0, 0], [q.w, q.h, 0], [0, q.h, 0]] as Vec3[]).map((p) => {
    const [x, y, z, w] = apply(m, p);
    return cam.project([x / w, y / w, z / w]);
  });
const err = (a: Pt[], b: Pt[]) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1])));
const desc = (b: FBox) => `${b.tag}.${b.cls} in ${b.ctx} #${b.i}`;

const isCap = (b: FBox) => b.cls.includes('rc-crate-cap');
const boxes = F.boxes.map((b, i) => ({ ...b, idx: i })).filter((b) => !isCap(b));

// One-to-one geometric matching: every pair within tolerance at both poses,
// assigned greedily from the smallest error (a shade 1px in front of its
// plane matches both within tolerance, its own quad much better).
function match() {
  const pairs: { b: number; q: number; e: number; eA: number; eB: number }[] = [];
  const projA = sceneA.quads.map((q) => corners(q, q.matrix, camA));
  const projB = sceneB.quads.map((q) => corners(q, q.matrix, camB));
  boxes.forEach((b, bi) => {
    sceneA.quads.forEach((_, qi) => {
      const eA = err(projA[qi], b.A);
      if (eA > tolOf(b)) return;
      const eB = err(projB[qi], b.B);
      if (eB > tolOf(b)) return;
      pairs.push({ b: bi, q: qi, e: Math.max(eA, eB), eA, eB });
    });
  });
  pairs.sort((x, y) => x.e - y.e);
  const byBox = new Map<number, (typeof pairs)[number]>();
  const usedQ = new Set<number>();
  for (const p of pairs) {
    if (byBox.has(p.b) || usedQ.has(p.q)) continue;
    byBox.set(p.b, p);
    usedQ.add(p.q);
  }
  return { byBox, usedQ };
}
const M = match();
const quadOfBox = (fixtureIndex: number): Quad | undefined => {
  const bi = boxes.findIndex((b) => b.idx === fixtureIndex);
  const p = M.byBox.get(bi);
  return p ? sceneA.quads[p.q] : undefined;
};

describe('scene geometry against the DOM room', () => {
  it('matches every DOM box with exactly one quad, at both poses', () => {
    const unmatched = boxes.filter((_, bi) => !M.byBox.has(bi)).map(desc);
    const extra = sceneA.quads.filter((_, qi) => !M.usedQ.has(qi)).map((q) => q.key);
    expect(unmatched).toEqual([]);
    expect(extra).toEqual([]);
    expect(sceneA.quads.length).toBe(boxes.length);
    const worstA = Math.max(...[...M.byBox.values()].map((p) => p.eA));
    const worstB = Math.max(...[...M.byBox.values()].map((p) => p.eB));
    console.log(`fixture boxes ${F.boxes.length} (${boxes.length} quads + ${F.boxes.length - boxes.length} crate captions); worst corner error A ${worstA.toFixed(3)} px, B ${worstB.toFixed(3)} px`);
  });

  it('gives each matched quad the DOM box size', () => {
    for (const [bi, p] of M.byBox) {
      const q = sceneA.quads[p.q];
      expect(Math.abs(q.w - boxes[bi].w), desc(boxes[bi])).toBeLessThan(0.05);
      expect(Math.abs(q.h - boxes[bi].h), desc(boxes[bi])).toBeLessThan(isPic(boxes[bi]) ? PIC_TOL : 0.05);
    }
  });

  it('lifts each picture to its :hover geometry', () => {
    let n = 0;
    for (const p of F.pictures) {
      if (!p.hover) continue;
      const q = quadOfBox(p.box);
      expect(q?.picture, desc(F.boxes[p.box])).toBeTruthy();
      expect(err(corners(q!, q!.picture!.hoverMatrix, camA), p.hover), desc(F.boxes[p.box])).toBeLessThan(PIC_TOL);
      n++;
    }
    expect(n).toBe(F.pictures.length);
  });

  it('puts captions where the DOM starts them', () => {
    for (const p of F.pictures) {
      if (!p.cap) continue;
      const q = quadOfBox(p.box)!;
      const c = q.picture!.caption;
      expect(c.align === 'right', desc(F.boxes[p.box])).toBe(p.cap.right);
      const [x, y, z, w] = apply(q.matrix, [c.x, c.y, 0]);
      const at = camA.project([x / w, y / w, z / w]);
      const want = c.align === 'right' ? p.cap.tr : p.cap.tl;
      expect(Math.hypot(at[0] - want[0], at[1] - want[1]), desc(F.boxes[p.box])).toBeLessThan(PIC_TOL);
    }
    // Crate captions: bottom-left corner at the anchor.
    const caps = F.boxes.filter(isCap);
    expect(caps.length).toBe(sceneA.crateCaptions.length);
    caps.forEach((b, i) => {
      for (const [pose, cam] of [['A', camA], ['B', camB]] as const) {
        const [x, y, z, w] = apply(sceneA.crateCaptions[i].matrix, [0, 0, 0]);
        const at = cam.project([x / w, y / w, z / w]);
        const want = b[pose][3];
        expect(Math.hypot(at[0] - want[0], at[1] - want[1]), `${desc(b)} ${pose}`).toBeLessThan(TOL);
      }
    });
  });

  it('picks what elementFromPoint picks at each picture centre', () => {
    let n = 0;
    for (const p of F.pictures) {
      if (p.hit === 'board') continue;
      if (typeof p.hit === 'object' && 'other' in p.hit && p.hit.other === null) continue; // centre off screen
      const own = quadOfBox(p.box)!;
      let want: Target | null;
      if (p.hit === 'self') want = own.picture!.target;
      else if (p.hit === 'crate') want = { kind: 'crate' };
      else if (typeof p.hit === 'object' && 'fig' in p.hit) want = quadOfBox(p.hit.fig)!.picture!.target;
      else want = null;
      expect(pick(sceneA.quads, camA, p.centre[0], p.centre[1]), `${desc(F.boxes[p.box])} ${JSON.stringify(p.hit)}`).toEqual(want);
      n++;
    }
    console.log(`pick records checked: ${n}`);
  });

  // A lifted picture slides sideways on screen. The hover must hold over the
  // place it hangs as well as the place it lifted to, or a pointer resting near
  // an edge would make it drop and lift again without end.
  it('keeps a lifted picture hovered over the place it hangs', () => {
    let n = 0;
    for (const q of sceneA.quads) {
      if (!q.picture || q.picture.hoverMatrix === q.matrix) continue;
      // Just inside each corner of the picture where it hangs.
      for (const [u, v] of [[2, 2], [q.w - 2, 2], [q.w - 2, q.h - 2], [2, q.h - 2]] as const) {
        const [x, y] = camA.project(apply(q.matrix, [u, v, 0]).slice(0, 3) as Vec3);
        if (hitTest(sceneA.quads, camA, x, y)?.quad.key !== q.key) continue; // covered there, or off screen
        expect(hitTest(sceneA.quads, camA, x, y, q.key)?.quad.key, q.key).toBe(q.key);
        n++;
      }
    }
    expect(n).toBeGreaterThan(40);
  });
});

describe('camera', () => {
  const close = (a: Rig, b: Rig) => {
    for (const k of ['dolly', 'sway', 'cam'] as const) a[k].forEach((v, i) => expect(Math.abs(v - b[k][i]), `${k}[${i}]`).toBeLessThan(2e-4 * Math.max(1, Math.abs(b[k][i]))));
  };

  it('builds the rig from numbers as the CSS does', () => {
    close(rigFromNumbers({ mx: 0, my: 0, amp: 0.4, tour: null, dollyZ: 0 }), rigFromCss(F.poses.A.rig));
    close(rigFromNumbers({ mx: 0.6, my: -0.5, amp: 1, tour: { r: 3, x: -24, y: 0, z: 50 }, dollyZ: 0 }), rigFromCss(F.poses.B.rig));
  });

  it('agrees between the clip matrix and the px projection', () => {
    for (const cam of [camA, camB, makeCamera(rigFromCss(F.poses.B.rig), 1.37, { left: 10, top: 20, width: 1700, height: 1000 })]) {
      for (const p of [[0, 0, 0], [-650, -640, -1000], [650, 380, -300], [-604, -384, -196], [300, 200, 150]] as Vec3[]) {
        const viaClip = clipToViewport(apply(cam.clip, p), cam.root);
        const viaPx = cam.project(p);
        expect(Math.abs(viaClip[0] - viaPx[0])).toBeLessThan(1e-6);
        expect(Math.abs(viaClip[1] - viaPx[1])).toBeLessThan(1e-6);
        const [, , z, w] = apply(cam.clip, p);
        expect(z / w).toBeGreaterThan(-1);
        expect(z / w).toBeLessThan(1);
      }
    }
  });
});

describe('scene structure', () => {
  it('lists the interactive targets in tab order', () => {
    const { tabOrder } = buildScene({ albums });
    const pieces = PLANE_ORDER.reduce((n, p) => n + HANGING[p].length, 0);
    expect(tabOrder.length).toBe(1 + pieces + 1);
    expect(tabOrder[0]).toEqual({ kind: 'view' });
    expect(tabOrder.filter((t) => t.kind === 'crate').length).toBe(1);
  });

  it('opens the crate from the front, top and side face of both crates', () => {
    for (const crate of ['crate1', 'crate2']) {
      for (const face of [0, 1, 2]) {
        const q = sceneA.quads.find((x) => x.key === `${crate}:${face}`);
        expect(q?.pick, `${crate}:${face}`).toEqual({ kind: 'crate' });
      }
    }
  });

  it('has unique keys', () => {
    const keys = sceneA.quads.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
