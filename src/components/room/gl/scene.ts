// The /notes room as data: one quad per box of the DOM room (RoomScene.tsx and
// room.css), each with its world matrix in room coordinates (CSS px, y down,
// the rig's origin at 0), composed exactly as CSS does: the parent chain, the
// left/top (or bottom) offset, transform-origin and transform. Pictures come
// from the hanging plan in layout.ts. Checked against the live DOM room by
// scene.test.ts (gl/__fixtures__/dom-quads.json).
// Pure: no DOM, no three.js.

import { ART, albumSrc, artSrc, type Album } from '@/lib/room';
import { HANGING, PLANE_ORDER, WINDOW_VIEW_ID, type Frame, type Lean, type PlaneId, type Slot } from '../layout';
import { boxMatrix, identity, multiply, translate, type Mat4 } from './mat4';
import {
  parseColor,
  parseGradients,
  parseShadows,
  uniformBorder,
  type Border,
  type Color,
  type Fill,
  type Paint,
  type Shadow,
} from './paint';
import IMAGE_SIZES from './image-sizes.json';

export type Target = { kind: 'art'; id: string } | { kind: 'album'; slot: number } | { kind: 'view' } | { kind: 'crate' };
export type Pick = 'none' | 'solid' | Target;

// Where a caption box starts, in the frame of its picture (or crate box):
// x, y of its top-left corner (left aligned) or top-right corner (right
// aligned), and its font size. A crate caption sits with its bottom-left
// corner at the anchor (anchor 'bottom').
export type Caption = { x: number; y: number; align: 'left' | 'right'; anchor: 'top' | 'bottom'; size: number };

export type PictureInfo = {
  frame: Frame | null;
  lean: Lean | null;
  target: Target;
  // World matrix in the :hover end state (the same as `matrix` for pieces
  // that do not lift: the window view and pieces on furniture).
  hoverMatrix: Mat4;
  caption: Caption;
};

export type Quad = {
  key: string;
  w: number;
  h: number;
  matrix: Mat4;
  paint: Paint;
  // Paint order (DOM order) for transparent layers that share a plane.
  rank: number;
  pick: Pick;
  // 'dom': stays real DOM above the canvas (board, chains); not drawn in GL.
  layer: 'room' | 'dom';
  picture?: PictureInfo;
};

export type Scene = {
  quads: Quad[];
  // Crate captions ("The record crate"): the world matrix of the anchor frame.
  crateCaptions: { matrix: Mat4; caption: Caption }[];
  // Interactive targets in today's tab order.
  tabOrder: Target[];
};

export type SceneOptions = {
  // The daily album list (pickDailyAlbums); null or missing: empty sleeves.
  albums?: (Album | null)[] | null;
  // The board and its chains step back in explore mode.
  mode?: 'read' | 'explore';
};

// --- Surfaces (room.css "Surfaces").

const tex = (name: string) => `/images/room/textures/${name}.webp`;
const c = parseColor;

type Surface = { texture: string; size: number; tint: string | null; overlays?: string[]; gradients?: string; fallback: string };

const SURFACES: Record<string, Surface> = {
  'rc-stone': { texture: tex('wall-stone'), size: 620, tint: '#e9dcc6', fallback: '#b9ad98' },
  'rc-reveal': { texture: tex('wall-stone'), size: 620, tint: '#e9dcc6', overlays: ['rgba(70, 46, 22, 0.38)'], fallback: '#8f8371' },
  'rc-reveal-lit': { texture: tex('wall-stone'), size: 620, tint: '#e9dcc6', overlays: ['rgba(255, 196, 120, 0.3)'], fallback: '#c9b596' },
  'rc-timber': { texture: tex('wall-timber'), size: 620, tint: '#c9a57c', fallback: '#4a3524' },
  'rc-ceilwood': { texture: tex('wall-timber'), size: 520, tint: '#7f8c72', fallback: '#2b3026' },
  'rc-planks': { texture: tex('floor-rustic-planks'), size: 480, tint: null, fallback: '#6b4a30' },
  'rc-beam': { texture: tex('beam-timber'), size: 512, tint: '#c7a985', fallback: '#3a2a1c' },
  'rc-beam-under': { texture: tex('beam-timber'), size: 512, tint: '#7a6450', fallback: '#22170e' },
  'rc-oak': { texture: tex('wood-oak'), size: 420, tint: '#c9a274', fallback: '#9a7648' },
  'rc-oak-top': { texture: tex('wood-oak'), size: 420, tint: '#e3c193', fallback: '#b08a58' },
  'rc-oak-dark': { texture: tex('wood-oak'), size: 420, tint: '#8a6844', fallback: '#5e4329' },
  'rc-oak-deep': { texture: tex('wood-oak'), size: 420, tint: '#5f462c', fallback: '#3d2a18' },
  'rc-trunk': {
    texture: tex('wood-walnut'),
    size: 360,
    tint: null,
    gradients: 'linear-gradient(90deg, rgba(0, 0, 0, 0) 56px, #1c120b 56px 72px, rgba(0, 0, 0, 0) 72px 228px, #1c120b 228px 244px, rgba(0, 0, 0, 0) 244px)',
    fallback: '#5a2f1c',
  },
  'rc-trunk-side': { texture: tex('wood-walnut'), size: 360, tint: null, overlays: ['rgba(0, 0, 0, 0.4)'], fallback: '#3a1f12' },
  'rw-reveal': { texture: tex('wall-timber'), size: 620, tint: '#c9a57c', overlays: ['rgba(30, 18, 8, 0.4)'], fallback: '#3a2a1c' },
  'rw-reveal-lit': { texture: tex('wall-timber'), size: 620, tint: '#c9a57c', overlays: ['rgba(255, 236, 196, 0.28)'], fallback: '#8a6c4c' },
  // .rw-wains: one texture layer multiplied with its background colour.
  'rw-wains': { texture: tex('wall-timber'), size: 310, tint: '#55744f', fallback: '#55744f' },
};

function tiled(surface: string, position: [number, number] = [0, 0]): Fill {
  const s = SURFACES[surface];
  return {
    kind: 'tiled',
    texture: s.texture,
    size: [s.size, s.size],
    position,
    tint: s.tint ? c(s.tint) : null,
    overlays: (s.overlays ?? []).map(c),
    gradients: s.gradients ? parseGradients(s.gradients) : [],
    fallback: c(s.fallback),
  };
}

const gradient = (css: string): Fill => ({ kind: 'gradient', layers: parseGradients(css) });
const NONE: Fill = { kind: 'none' };

// --- Pictures (room.css "Pictures").

const FRAMES: Record<Frame, { border: Border | null; pad: number; mat: Color | null }> = {
  'rs-black': { border: uniformBorder(9, '#141113'), pad: 14, mat: c('#f3ede0') },
  'rs-oak': { border: uniformBorder(8, '#a2764a'), pad: 12, mat: c('#f3ede0') },
  'rs-gilt': { border: { width: [12, 12, 12, 12], color: [c('#d2ad5c'), c('#94702b'), c('#7f5e22'), c('#bd9645')] }, pad: 0, mat: null },
  'rs-thin': { border: uniformBorder(4, '#efe8d8'), pad: 0, mat: null },
  'rs-sl': { border: null, pad: 0, mat: null },
};

const LEAN: Record<Lean, { rest: string; hover: string }> = {
  'rs-lean': { rest: 'translateZ(58px) rotateX(14deg)', hover: 'translateZ(120px) rotateX(6deg)' },
  'rs-lean2': { rest: 'translateZ(98px) rotateX(13deg)', hover: 'translateZ(150px) rotateX(6deg)' },
  'rs-lean3': { rest: 'translateZ(138px) rotateX(12deg)', hover: 'translateZ(184px) rotateX(6deg)' },
  'rc-on': { rest: 'translateZ(-22px) rotateX(7deg)', hover: 'translateZ(28px) rotateX(2deg)' },
};

const PICTURE_SHADOWS = parseShadows('0 2px 3px rgba(0, 0, 0, 0.55), 0 20px 34px -8px rgba(0, 0, 0, 0.7)');
const SLEEVE = c('#17110c');
const SLEEVE_LINE = { width: 1, offset: -1, color: c('rgba(255, 255, 255, 0.1)') };
const CAPTION_GAP = 10; // figcaption margin-top
const CAPTION_SIZE = 22;
const VIEW_CAPTION = { x: 560, y: 540, size: 40 };

const SIZES = IMAGE_SIZES as unknown as { art: Record<string, [number, number]>; albums: Record<string, [number, number]>; rugs: Record<string, [number, number]> };

// Natural size of an image file (the file the DOM room shows), falling back to
// the size in the data when the file is not listed.
function artSize(id: string): [number, number] {
  const s = SIZES.art[id];
  if (s) return s;
  const a = ART.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown art id: ${id}`);
  return [a.width, a.height];
}

// Index of the first album slot on each plane (as ALBUM_OFFSET in RoomScene.tsx).
export const ALBUM_OFFSET: Record<PlaneId, number> = (() => {
  const out = {} as Record<PlaneId, number>;
  let n = 0;
  for (const p of PLANE_ORDER) {
    out[p] = n;
    n += HANGING[p].filter((s) => s.kind === 'album').length;
  }
  return out;
})();

// --- Builder.

class Builder {
  quads: Quad[] = [];
  crateCaptions: Scene['crateCaptions'] = [];

  add(q: Omit<Quad, 'rank' | 'layer'> & { layer?: Quad['layer'] }): Quad {
    const quad: Quad = { layer: 'room', ...q, rank: this.quads.length };
    this.quads.push(quad);
    return quad;
  }
}

type Box = { x: number; y: number; w: number; h: number; transform?: string; origin?: string };
const world = (parent: Mat4, b: Box) => multiply(parent, boxMatrix(b.x, b.y, b.w, b.h, b.transform, b.origin));

// A hung piece. `parent` is the containing block's world matrix and `parentH`
// its height (for pieces placed with bottom: 0).
function picture(
  bd: Builder,
  key: string,
  parent: Mat4,
  parentH: number,
  slot: Slot,
  target: Target,
  albums: (Album | null)[] | null,
  captionAlign: 'left' | 'right'
) {
  const f = FRAMES[slot.frame];
  const bw = f.border ? f.border.width[0] : 0;
  const inset = bw + f.pad;
  const cw = slot.width - 2 * inset;
  let fill: Fill;
  let contentH: number;
  if (slot.kind === 'art') {
    const [nw, nh] = artSize(slot.id);
    contentH = (cw * nh) / nw;
    fill = { kind: 'picture', source: { kind: 'art', id: slot.id, src: artSrc(slot.id, 'wall') }, mat: f.mat, image: [inset, inset, cw, contentH], sleeve: null, filter: null };
  } else {
    const slotIndex = (target as { slot: number }).slot;
    const album = albums?.[slotIndex] ?? null;
    const nat = album ? (SIZES.albums[album.id] ?? [album.width, album.height]) : null;
    const coverH = nat ? (cw * nat[1]) / nat[0] : cw;
    // The sleeve keeps aspect-ratio 1 but grows to a taller cover.
    contentH = Math.max(cw, coverH);
    fill = {
      kind: 'picture',
      source: { kind: 'album', slot: slotIndex, id: album?.id ?? null, src: album ? albumSrc(album.id, 'wall') : null },
      mat: f.mat,
      image: [inset, inset, cw, coverH],
      sleeve: { rect: [inset, inset, cw, contentH], color: SLEEVE, fadeIn: 0.6 },
      filter: null,
    };
  }
  const w = slot.width;
  const h = contentH + 2 * inset;
  const y = slot.top ?? parentH - h - (slot.bottom ?? 0);
  const restT = slot.transform ?? (slot.lean ? LEAN[slot.lean].rest : 'translateZ(4px)');
  const hoverT = slot.transform ?? (slot.lean ? LEAN[slot.lean].hover : 'translateZ(54px)');
  const origin = slot.transformOrigin ?? (slot.lean ? '50% 100%' : undefined);
  const matrix = world(parent, { x: slot.left, y, w, h, transform: restT, origin });
  const hoverMatrix = world(parent, { x: slot.left, y, w, h, transform: hoverT, origin });
  const paint: Paint = { fill, shadows: PICTURE_SHADOWS };
  if (f.border) paint.border = f.border;
  if (slot.frame === 'rs-sl') {
    paint.radius = 2;
    paint.outline = SLEEVE_LINE;
  }
  bd.add({
    key,
    w,
    h,
    matrix,
    paint,
    pick: target,
    picture: {
      frame: slot.frame,
      lean: slot.lean ?? null,
      target,
      hoverMatrix,
      caption: {
        x: captionAlign === 'left' ? bw : w - bw,
        y: h - bw + CAPTION_GAP,
        align: captionAlign,
        anchor: 'top',
        size: CAPTION_SIZE,
      },
    },
  });
}

function slots(bd: Builder, plane: PlaneId, parent: Mat4, parentH: number, albums: (Album | null)[] | null) {
  let albumIndex = ALBUM_OFFSET[plane];
  HANGING[plane].forEach((slot, i) => {
    const target: Target = slot.kind === 'art' ? { kind: 'art', id: slot.id } : { kind: 'album', slot: albumIndex++ };
    picture(bd, `pic:${plane}:${i}`, parent, parentH, slot, target, albums, plane === 'rs-back-r' ? 'right' : 'left');
  });
}

// --- Planes (room.css "Planes").

type PlaneDef = { x: number; y: number; w: number; h: number; transform: string; fill: Fill; pick?: Pick; paint?: Partial<Paint> };

const ROOM = identity();

function plane(bd: Builder, key: string, d: PlaneDef): Mat4 {
  const m = world(ROOM, { x: d.x, y: d.y, w: d.w, h: d.h, transform: d.transform });
  bd.add({ key: `plane:${key}`, w: d.w, h: d.h, matrix: m, paint: { fill: d.fill, ...d.paint }, pick: d.pick ?? 'solid' });
  return m;
}

// .rs-shade: the plane's full box, 1px in front (or its inline transform).
function shade(bd: Builder, key: string, parent: Mat4, w: number, h: number, css: string, transform = 'translateZ(1px)') {
  bd.add({ key: `shade:${key}`, w, h, matrix: world(parent, { x: 0, y: 0, w, h, transform }), paint: { fill: gradient(css) }, pick: 'none' });
}

function glow(bd: Builder, key: string, parent: Mat4, w: number, h: number, css: string) {
  bd.add({ key: `glow:${key}`, w, h, matrix: world(parent, { x: 0, y: 0, w, h, transform: 'translateZ(1px)' }), paint: { fill: gradient(css) }, pick: 'none' });
}

// .rw-wains and .rw-rail at the foot of a wall of height h.
function wainscot(bd: Builder, key: string, parent: Mat4, w: number, h: number, position: [number, number]) {
  bd.add({ key: `wains:${key}`, w, h: 320, matrix: world(parent, { x: 0, y: h - 320, w, h: 320, transform: 'translateZ(2px)' }), paint: { fill: tiled('rw-wains', position) }, pick: 'none' });
  bd.add({
    key: `rail:${key}`,
    w,
    h: 12,
    matrix: world(parent, { x: 0, y: h - 308 - 12, w, h: 12, transform: 'translateZ(3px)' }),
    paint: { fill: gradient('linear-gradient(180deg, #6f8f66, #3f5a3b)'), shadows: parseShadows('0 2px 3px rgba(0, 0, 0, 0.4)') },
    pick: 'none',
  });
}

// A window frame (border 18px) with its two mullions, all pointer-events: none.
function windowFrame(bd: Builder, key: string, x: number, y: number, transform: string) {
  const W = 380;
  const H = 440;
  const B = 18;
  const m = plane(bd, key, {
    x,
    y,
    w: W,
    h: H,
    transform,
    fill: NONE,
    pick: 'none',
    paint: { border: uniformBorder(B, '#3b2819'), shadows: parseShadows('inset 0 0 0 2px rgba(0, 0, 0, 0.35)') },
  });
  const pw = W - 2 * B;
  const ph = H - 2 * B;
  const bar: Paint = { fill: { kind: 'solid', color: c('#3b2819') } };
  bd.add({ key: `mullion-v:${key}`, w: 14, h: ph, matrix: world(m, { x: B + pw / 2 - 7, y: B, w: 14, h: ph }), paint: bar, pick: 'none' });
  bd.add({ key: `mullion-h:${key}`, w: pw, h: 14, matrix: world(m, { x: B, y: B + 0.44 * ph, w: pw, h: 14 }), paint: bar, pick: 'none' });
}

// --- Boxes (furniture, beams).

const TOP_FACE = { origin: '0 0', transform: 'rotateX(-90deg)' };
const SIDE_FACE = { origin: '0 0', transform: 'rotateY(90deg)' };

type FaceDef = { x?: number; y?: number; w: number; h: number; transform?: string; origin?: string; fill: Fill; paint?: Partial<Paint>; pick?: Pick };

function faces(bd: Builder, key: string, box: Mat4, defs: FaceDef[], pick: Pick, layer: Quad['layer'] = 'room') {
  defs.forEach((d, i) => {
    bd.add({
      key: `${key}:${i}`,
      w: d.w,
      h: d.h,
      matrix: world(box, { x: d.x ?? 0, y: d.y ?? 0, w: d.w, h: d.h, transform: d.transform, origin: d.origin }),
      paint: { fill: d.fill, ...d.paint },
      pick: d.pick ?? pick,
      layer,
    });
  });
}

const boxAt = (transform: string) => boxMatrix(0, 0, 0, 0, transform);

const SHELF_SIDE = (light: string, dark: string, fill: string): Omit<FaceDef, 'x'> => ({
  y: 0,
  w: 60,
  h: 560,
  ...SIDE_FACE,
  fill: gradient(
    `linear-gradient(180deg, ${fill} 0 16px, rgba(0,0,0,0) 16px 175px, ${fill} 175px 191px, rgba(0,0,0,0) 191px 355px, ${fill} 355px 371px, rgba(0,0,0,0) 371px 540px, ${fill} 540px 560px)`
  ),
  paint: {
    border: { width: [0, 12, 0, 12], color: [c('#000'), c(dark), c('#000'), c(light)] },
  },
});

function crate(
  bd: Builder,
  key: string,
  transform: string,
  d: { width: number; height: number; depth: number; caption: { y: number; z: number }; stripes: string },
  plane: PlaneId,
  albums: (Album | null)[] | null
) {
  const box = boxAt(transform);
  const crateTarget: Target = { kind: 'crate' };
  faces(
    bd,
    key,
    box,
    [
      { w: d.width, h: d.height, fill: tiled('rc-oak'), paint: { shadows: parseShadows('inset 0 0 0 6px rgba(0,0,0,.22)') } },
      { w: d.width, h: d.depth, ...TOP_FACE, fill: gradient(d.stripes) },
      { w: d.depth, h: d.height, ...SIDE_FACE, fill: tiled('rc-oak-dark') },
    ],
    crateTarget
  );
  slots(bd, plane, box, 0, albums);
  bd.crateCaptions.push({
    matrix: multiply(box, translate(0, d.caption.y, d.caption.z)),
    caption: { x: 0, y: 0, align: 'left', anchor: 'bottom', size: CAPTION_SIZE },
  });
}

// --- The room.

export function buildScene(opts: SceneOptions = {}): Scene {
  const albums = opts.albums ?? null;
  const explore = opts.mode === 'explore';
  const bd = new Builder();

  // The window view: the clickable piece behind the back window ...
  {
    const [nw, nh] = artSize(WINDOW_VIEW_ID);
    const w = 1200;
    const h = (w * nh) / nw;
    const m = world(ROOM, { x: -365, y: -570, w, h, transform: 'translateZ(-1660px)' });
    const target: Target = { kind: 'view' };
    bd.add({
      key: 'pic:view',
      w,
      h,
      matrix: m,
      paint: {
        fill: {
          kind: 'picture',
          source: { kind: 'art', id: WINDOW_VIEW_ID, src: artSrc(WINDOW_VIEW_ID, 'wall') },
          mat: null,
          image: [0, 0, w, h],
          sleeve: null,
          filter: { brightness: 1.12, saturate: 1.06 },
        },
      },
      pick: target,
      picture: { frame: null, lean: null, target, hoverMatrix: m, caption: { ...VIEW_CAPTION, align: 'left', anchor: 'top' } },
    });
  }
  // ... and its mirrored copy outside the left window.
  {
    const m = plane(bd, 'rw-view', { x: -750, y: -960, w: 1500, h: 1190, transform: 'translate3d(-1250px, 0, -1600px) rotateY(90deg)', fill: NONE, pick: 'none' });
    const [nw, nh] = artSize(WINDOW_VIEW_ID);
    const w = 1500;
    const h = (w * nh) / nw;
    bd.add({
      key: 'img:rw-view',
      w,
      h,
      matrix: world(m, { x: 0, y: 0, w, h, transform: 'scaleX(-1)' }),
      paint: { fill: { kind: 'image', src: artSrc(WINDOW_VIEW_ID, 'wall'), filter: { brightness: 1.1, saturate: 1.05 }, mirroredByMatrix: true } },
      pick: 'none',
    });
  }

  // Floor, with rugs, light shafts and shade.
  {
    const W = 1300;
    const H = 1400;
    const m = plane(bd, 'rs-floor', { x: -650, y: -700, w: W, h: H, transform: 'translate3d(0, 380px, -300px) rotateX(90deg)', fill: tiled('rc-planks') });
    const rug = (key: string, file: string, x: number, y: number, w: number, transform: string) => {
      const [nw, nh] = SIZES.rugs[file];
      const h = (w * nh) / nw;
      bd.add({
        key: `rug:${key}`,
        w,
        h,
        matrix: world(m, { x, y, w, h, transform }),
        paint: { fill: { kind: 'image', src: `/images/room/rugs/${file}.webp`, filter: null, mirroredByMatrix: false }, shadows: parseShadows('0 0 14px rgba(0, 0, 0, 0.45)') },
        pick: 'solid',
      });
    };
    rug('kilim', 'rug-kilim', 500, 330, 300, 'translateZ(1px)');
    rug('persian', 'rug-persian-red', 880, 540, 320, 'translateZ(1px) rotate(12deg)');
    const shaftColor = c('rgba(255, 240, 205, 0.3)');
    bd.add({
      key: 'shaft:b',
      w: 380,
      h: 400,
      matrix: world(m, { x: 804, y: 300, w: 380, h: 400, transform: 'translateZ(2px) skewX(4.6deg)', origin: '0 0' }),
      paint: { fill: { kind: 'rects', color: shaftColor, rects: [[0, 0, 178, 212], [202, 0, 178, 212], [0, 236, 178, 164], [202, 236, 178, 164]] }, blur: 14 },
      pick: 'none',
    });
    bd.add({
      key: 'shaft:l',
      w: 400,
      h: 380,
      matrix: world(m, { x: 318, y: 498, w: 400, h: 380, transform: 'translateZ(2px) skewY(6.8deg)', origin: '0 0' }),
      paint: { fill: { kind: 'rects', color: shaftColor, rects: [[0, 0, 212, 178], [236, 0, 164, 178], [0, 202, 212, 178], [236, 202, 164, 178]] }, blur: 14 },
      pick: 'none',
    });
    shade(
      bd,
      'rs-floor',
      m,
      W,
      H,
      'radial-gradient(ellipse 26% 22% at 78% 36%, rgba(255,240,205,.16), rgba(255,240,205,0) 70%), radial-gradient(ellipse 24% 22% at 40% 50%, rgba(255,240,205,.14), rgba(255,240,205,0) 70%), radial-gradient(ellipse 26% 18% at 52% 40%, rgba(255,180,100,.06), rgba(255,180,100,0) 70%), radial-gradient(ellipse 20% 7% at 50% 44%, rgba(0,0,0,.34), rgba(0,0,0,0) 72%), radial-gradient(ellipse 6% 22% at 24% 27%, rgba(0,0,0,.3), rgba(0,0,0,0) 75%), radial-gradient(ellipse 10% 16% at 86% 44%, rgba(0,0,0,.3), rgba(0,0,0,0) 75%), radial-gradient(ellipse 14% 8% at 75% 9%, rgba(0,0,0,.3), rgba(0,0,0,0) 75%), linear-gradient(90deg, rgba(0,0,0,.24), rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,.24)), linear-gradient(180deg, rgba(255,240,205,.06), rgba(0,0,0,0) 30%, rgba(0,0,0,.16) 100%)',
      'translateZ(3px)'
    );
  }

  {
    const m = plane(bd, 'rs-ceil', { x: -650, y: -700, w: 1300, h: 1400, transform: 'translate3d(0, -640px, -300px) rotateX(-90deg)', fill: tiled('rc-ceilwood') });
    shade(bd, 'rs-ceil', m, 1300, 1400, 'radial-gradient(ellipse 40% 30% at 52% 60%, rgba(255,180,100,.05), rgba(255,180,100,0) 70%), linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.04) 60%, rgba(0,0,0,.14))');
  }

  // Back wall, in four pieces around the window.
  {
    const m = plane(bd, 'rs-back-l', { x: -650, y: -640, w: 780, h: 1020, transform: 'translateZ(-1000px)', fill: tiled('rc-stone') });
    shade(
      bd,
      'rs-back-l',
      m,
      780,
      1020,
      'radial-gradient(ellipse 42% 46% at 122% 46%, rgba(255,240,205,.32), rgba(255,240,205,0) 70%), radial-gradient(ellipse 50% 30% at 46% 52%, rgba(255,236,200,.08), rgba(255,236,200,0) 70%), linear-gradient(180deg, rgba(40,26,14,.2), rgba(40,26,14,.02) 26%, rgba(40,26,14,.02) 74%, rgba(40,26,14,.22)), linear-gradient(90deg, rgba(40,26,14,.14), rgba(40,26,14,0) 30%)'
    );
    wainscot(bd, 'rs-back-l', m, 780, 1020, [0, 0]);
    slots(bd, 'rs-back-l', m, 1020, albums);
  }
  {
    const m = plane(bd, 'rs-back-t', { x: 130, y: -640, w: 380, h: 250, transform: 'translateZ(-1000px)', fill: tiled('rc-stone', [-780, 0]) });
    shade(bd, 'rs-back-t', m, 380, 250, 'radial-gradient(ellipse 70% 80% at 50% 120%, rgba(255,240,205,.36), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(40,26,14,.2), rgba(40,26,14,.02))');
    slots(bd, 'rs-back-t', m, 250, albums);
  }
  {
    const m = plane(bd, 'rs-back-b', { x: 130, y: 50, w: 380, h: 330, transform: 'translateZ(-1000px)', fill: tiled('rc-stone', [-780, -690]) });
    shade(bd, 'rs-back-b', m, 380, 330, 'radial-gradient(ellipse 70% 60% at 50% -14%, rgba(255,240,205,.3), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(40,26,14,.02), rgba(40,26,14,.22))');
    wainscot(bd, 'rs-back-b', m, 380, 330, [-780, 0]);
  }
  {
    const m = plane(bd, 'rs-back-r', { x: 510, y: -640, w: 140, h: 1020, transform: 'translateZ(-1000px)', fill: tiled('rc-stone', [-1160, 0]) });
    shade(
      bd,
      'rs-back-r',
      m,
      140,
      1020,
      'radial-gradient(ellipse 120% 40% at -40% 46%, rgba(255,240,205,.32), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(40,26,14,.2), rgba(40,26,14,.02) 26%, rgba(40,26,14,.02) 74%, rgba(40,26,14,.22))'
    );
    wainscot(bd, 'rs-back-r', m, 140, 1020, [-1160, 0]);
    slots(bd, 'rs-back-r', m, 1020, albums);
  }

  // Back window: jambs, head, sill, frame.
  plane(bd, 'rc-jamb-l', { x: -30, y: -390, w: 60, h: 440, transform: 'translate3d(130px, 0, -1030px) rotateY(90deg)', fill: tiled('rc-reveal') });
  {
    const m = plane(bd, 'rc-jamb-r', { x: -30, y: -390, w: 60, h: 440, transform: 'translate3d(510px, 0, -1030px) rotateY(-90deg)', fill: tiled('rc-reveal-lit') });
    glow(bd, 'rc-jamb-r', m, 60, 440, 'linear-gradient(90deg, rgba(255,244,214,.5), rgba(255,244,214,.1))');
  }
  plane(bd, 'rc-head', { x: 130, y: -420, w: 380, h: 60, transform: 'translateZ(-1030px) rotateX(-90deg)', fill: tiled('rc-reveal') });
  {
    const m = plane(bd, 'rc-sill', { x: 130, y: 20, w: 380, h: 60, transform: 'translateZ(-1030px) rotateX(90deg)', fill: tiled('rc-oak-top') });
    glow(bd, 'rc-sill', m, 380, 60, 'linear-gradient(180deg, rgba(255,244,214,.5), rgba(255,244,214,.12))');
  }
  windowFrame(bd, 'rc-frame', 130, -390, 'translateZ(-1056px)');

  // Left wall, in pieces around the left window.
  {
    const m = plane(bd, 'rw-la', { x: -280, y: -640, w: 560, h: 1020, transform: 'translate3d(-650px, 0, 120px) rotateY(90deg)', fill: tiled('rc-timber') });
    shade(bd, 'rw-la', m, 560, 1020, 'radial-gradient(ellipse 46% 40% at 108% 44%, rgba(255,240,205,.2), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.26))');
    slots(bd, 'rw-la', m, 1020, albums);
  }
  {
    const m = plane(bd, 'rw-lt', { x: -190, y: -640, w: 380, h: 230, transform: 'translate3d(-650px, 0, -350px) rotateY(90deg)', fill: tiled('rc-timber', [-560, 0]) });
    shade(bd, 'rw-lt', m, 380, 230, 'radial-gradient(ellipse 70% 80% at 50% 124%, rgba(255,240,205,.22), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0))');
    slots(bd, 'rw-lt', m, 230, albums);
  }
  {
    const m = plane(bd, 'rw-lb', { x: -190, y: 30, w: 380, h: 350, transform: 'translate3d(-650px, 0, -350px) rotateY(90deg)', fill: tiled('rc-timber', [-560, -670]) });
    shade(bd, 'rw-lb', m, 380, 350, 'radial-gradient(ellipse 70% 50% at 50% -12%, rgba(255,240,205,.18), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,0) 36%, rgba(0,0,0,.26))');
    bd.add({ key: 'ledge:rw-lb', w: 380, h: 10, matrix: world(m, { x: 0, y: 0, w: 380, h: 10, transform: 'translateZ(24px)' }), paint: { fill: tiled('rc-oak-dark') }, pick: 'solid' });
    slots(bd, 'rw-lb', m, 350, albums);
  }
  {
    const m = plane(bd, 'rw-lc', { x: -230, y: -640, w: 460, h: 1020, transform: 'translate3d(-650px, 0, -770px) rotateY(90deg)', fill: tiled('rc-timber', [-940, 0]) });
    shade(bd, 'rw-lc', m, 460, 1020, 'radial-gradient(ellipse 46% 40% at -8% 44%, rgba(255,240,205,.2), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.26))');
    slots(bd, 'rw-lc', m, 1020, albums);
  }

  // Left window: jambs, head, sill, frame.
  plane(bd, 'rw-jamb-n', { x: -710, y: -410, w: 60, h: 440, transform: 'translateZ(-160px)', fill: tiled('rw-reveal') });
  {
    const m = plane(bd, 'rw-jamb-f', { x: -710, y: -410, w: 60, h: 440, transform: 'translateZ(-540px)', fill: tiled('rw-reveal-lit') });
    glow(bd, 'rw-jamb-f', m, 60, 440, 'linear-gradient(90deg, rgba(255,244,214,.46), rgba(255,244,214,.08))');
  }
  {
    const m = plane(bd, 'rw-head', { x: -710, y: -190, w: 60, h: 380, transform: 'translate3d(0, -410px, -350px) rotateX(-90deg)', fill: tiled('rw-reveal') });
    glow(bd, 'rw-head', m, 60, 380, 'linear-gradient(90deg, rgba(255,244,214,.2), rgba(255,244,214,0))');
  }
  {
    const m = plane(bd, 'rw-sill', { x: -710, y: -190, w: 84, h: 380, transform: 'translate3d(0, 30px, -350px) rotateX(90deg)', fill: tiled('rc-oak-top') });
    glow(bd, 'rw-sill', m, 84, 380, 'linear-gradient(90deg, rgba(255,244,214,.5), rgba(255,244,214,.12))');
  }
  windowFrame(bd, 'rw-frame', -190, -410, 'translate3d(-706px, 0, -350px) rotateY(90deg)');

  {
    const m = plane(bd, 'rs-right', { x: -700, y: -640, w: 1400, h: 1020, transform: 'translate3d(650px, 0, -300px) rotateY(-90deg)', fill: tiled('rc-timber') });
    shade(
      bd,
      'rs-right',
      m,
      1400,
      1020,
      'radial-gradient(ellipse 22% 34% at 16% 40%, rgba(255,240,205,.14), rgba(255,240,205,0) 70%), radial-gradient(ellipse 22% 34% at 42% 38%, rgba(255,240,205,.16), rgba(255,240,205,0) 70%), radial-gradient(ellipse 20% 30% at 64% 36%, rgba(255,240,205,.16), rgba(255,240,205,0) 70%), radial-gradient(ellipse 22% 34% at 86% 46%, rgba(255,240,205,.1), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.26))'
    );
    slots(bd, 'rs-right', m, 1020, albums);
  }

  // Shelf unit: pointer-events none for everything but its pictures.
  {
    const m = plane(bd, 'rc-unit', { x: -270, y: -180, w: 540, h: 560, transform: 'translate3d(-320px, 0, -630px) rotateY(90deg)', fill: NONE, pick: 'none' });
    const defs: FaceDef[] = [
      ...[0, 262, 524].map((x) => ({ x, w: 16, h: 560, fill: tiled('rc-oak-dark') })),
      ...[0, 262, 524].map((x) => ({ x, w: 16, h: 560, transform: 'translateZ(-60px)', fill: tiled('rc-oak-deep') })),
      { x: 0, ...SHELF_SIDE('#6b4c2e', '#4a3320', '#5a3f27') },
      { x: 540, ...SHELF_SIDE('#4a3320', '#33231a', '#3d2a18') },
      ...[0, 175, 355, 540].map((y) => ({ x: 0, y, w: 540, h: 60, ...TOP_FACE, fill: tiled('rc-oak-top') })),
      ...[0, 175, 355, 540].map((y) => ({ x: 0, y, w: 540, h: y === 540 ? 20 : 16, fill: tiled('rc-oak-dark') })),
    ];
    faces(bd, 'unit', m, defs, 'none');
    slots(bd, 'rc-unit', m, 560, albums);
  }

  // Bench and its legs.
  faces(
    bd,
    'bench',
    boxAt('translate3d(-200px, 300px, -330px)'),
    [
      { w: 400, h: 24, fill: tiled('rc-oak') },
      { w: 400, h: 120, ...TOP_FACE, fill: tiled('rc-oak-top') },
      { w: 120, h: 24, ...SIDE_FACE, fill: tiled('rc-oak-deep') },
      { x: 400, w: 120, h: 24, ...SIDE_FACE, fill: tiled('rc-oak-dark') },
    ],
    'solid'
  );
  faces(
    bd,
    'leg-l',
    boxAt('translate3d(-180px, 324px, -340px)'),
    [
      { w: 28, h: 56, fill: tiled('rc-oak-dark') },
      { w: 100, h: 56, ...SIDE_FACE, fill: tiled('rc-oak-deep') },
      { x: 28, w: 100, h: 56, ...SIDE_FACE, fill: tiled('rc-oak-dark') },
    ],
    'solid'
  );
  faces(
    bd,
    'leg-r',
    boxAt('translate3d(152px, 324px, -340px)'),
    [
      { w: 28, h: 56, fill: tiled('rc-oak-dark') },
      { w: 100, h: 56, ...SIDE_FACE, fill: tiled('rc-oak-dark') },
      { x: 28, w: 100, h: 56, ...SIDE_FACE, fill: tiled('rc-oak-deep') },
    ],
    'solid'
  );

  // Trunk, with the pieces set on it.
  {
    const box = boxAt('translate3d(180px, 250px, -820px)');
    faces(
      bd,
      'trunk',
      box,
      [
        { w: 300, h: 130, fill: tiled('rc-trunk'), paint: { shadows: parseShadows('inset 0 0 0 5px rgba(0,0,0,.28)') } },
        { w: 300, h: 150, ...TOP_FACE, fill: tiled('rc-trunk') },
        { w: 150, h: 130, ...SIDE_FACE, fill: tiled('rc-trunk-side') },
      ],
      'solid'
    );
    slots(bd, 'trunk', box, 0, albums);
  }

  crate(
    bd,
    'crate1',
    'translate3d(450px, 230px, -200px)',
    {
      width: 170,
      height: 150,
      depth: 380,
      caption: { y: -100, z: 110 },
      stripes:
        'repeating-linear-gradient(180deg, #e9dfcc 0 3px, #1a1416 3px 5px, #c8452c 5px 8px, #1a1416 8px 10px, #e3a72f 10px 13px, #1a1416 13px 15px, #2438c9 15px 18px, #1a1416 18px 20px, #f1e9da 20px 23px, #1a1416 23px 25px, #1f8a8a 25px 28px, #1a1416 28px 31px)',
    },
    'crate1',
    albums
  );
  crate(
    bd,
    'crate2',
    'translate3d(480px, 250px, -650px)',
    {
      width: 150,
      height: 130,
      depth: 240,
      caption: { y: -150, z: 10 },
      stripes:
        'repeating-linear-gradient(180deg, #f1e9da 0 3px, #1a1416 3px 5px, #2f6b4a 5px 8px, #1a1416 8px 10px, #d9662b 10px 13px, #1a1416 13px 15px, #e9dfcc 15px 18px, #1a1416 18px 20px, #7a2e52 20px 23px, #1a1416 23px 26px)',
    },
    'crate2',
    albums
  );

  // Hanging lamp: cord and glowing shade.
  faces(
    bd,
    'lamp',
    boxAt('translate3d(12px, -530px, -445px)'),
    [
      { x: 27, w: 2, h: 190, fill: { kind: 'solid', color: c('#140d08') } },
      {
        y: 190,
        w: 56,
        h: 84,
        fill: gradient('radial-gradient(ellipse 60% 55% at 50% 55%, #fff3cf 0%, #ffcf7a 38%, #e08a2c 78%, #7a4414 100%)'),
        paint: {
          border: uniformBorder(4, '#22160d'),
          radius: 6,
          shadows: parseShadows('0 0 70px 34px rgba(255,176,90,.11), 0 0 18px 6px rgba(255,210,140,.17)'),
        },
      },
    ],
    'solid'
  );

  // The board layer: ceiling beams (pointer-events: none there today), then
  // the chains and the letter board, which stay DOM.
  for (const z of [100, -150, -400, -650]) {
    faces(
      bd,
      `beam:${z}`,
      boxAt(`translate3d(-650px, -640px, ${z}px)`),
      [
        { w: 1300, h: 110, fill: tiled('rc-beam') },
        { y: 110, w: 1300, h: 90, origin: '0 0', transform: 'rotateX(-90deg)', fill: tiled('rc-beam-under') },
      ],
      'none'
    );
  }
  const back = explore ? 'translateZ(-480px)' : 'translateZ(-196px)';
  for (const [i, x] of [-570, -78].entries()) {
    bd.add({ key: `chain:${i}`, w: 4, h: 150, matrix: world(ROOM, { x, y: -530, w: 4, h: 150, transform: back }), paint: { fill: { kind: 'dom', element: 'chain' } }, pick: 'none', layer: 'dom' });
  }
  bd.add({
    key: 'board',
    w: 564,
    h: 656,
    matrix: world(ROOM, { x: -604, y: -384, w: 564, h: 656, transform: back, origin: '50% 100%' }),
    paint: { fill: { kind: 'dom', element: 'board' } },
    pick: 'none',
    layer: 'dom',
  });

  return { quads: bd.quads, crateCaptions: bd.crateCaptions, tabOrder: tabOrder() };
}

// Today's tab order: the window view, then every piece in PLANE_ORDER, with
// the crate's button where the first crate's front face comes (before the
// albums standing in it).
export function tabOrder(): Target[] {
  const out: Target[] = [{ kind: 'view' }];
  let album = 0;
  for (const p of PLANE_ORDER) {
    if (p === 'crate1') out.push({ kind: 'crate' });
    for (const s of HANGING[p]) out.push(s.kind === 'art' ? { kind: 'art', id: s.id } : { kind: 'album', slot: album++ });
  }
  return out;
}

export type { Shadow };
