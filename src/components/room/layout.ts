// The hanging plan for the /notes room: which piece goes where, on which plane.
// Positions are in the plane's local px (see the room kit conventions): `left`
// and `top` from the plane's top-left, or `bottom: 0` for pieces leaning on the
// floor. Album slots are filled at runtime from a daily shuffle of the albums.

export type Frame = 'rs-black' | 'rs-oak' | 'rs-gilt' | 'rs-thin' | 'rs-sl';
export type Lean = 'rs-lean' | 'rs-lean2' | 'rs-lean3' | 'rc-on';

export type SlotContent = { kind: 'art'; id: string } | { kind: 'album' };

export type Slot = SlotContent & {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  frame: Frame;
  lean?: Lean;
  // Own transform for pieces set on furniture (trunk, crates).
  transform?: string;
  transformOrigin?: string;
};

export type PlaneId =
  | 'rs-back-l'
  | 'rs-back-t'
  | 'rs-back-r'
  | 'rw-la'
  | 'rw-lt'
  | 'rw-lb'
  | 'rw-lc'
  | 'rs-right'
  | 'rc-unit'
  | 'trunk'
  | 'crate1'
  | 'crate2';

const art = (id: string) => ({ kind: 'art' as const, id });
const album = { kind: 'album' as const };
const onFurniture = (transform: string) => ({ transform, transformOrigin: '50% 100%' });

export const HANGING: Record<PlaneId, Slot[]> = {
  'rs-back-l': [
    { ...art('gauguin-mahana-no-atua'), left: 56, top: 380, width: 320, frame: 'rs-gilt' },
    { ...art('signac-opus-217'), left: 400, top: 372, width: 330, frame: 'rs-black' },
    { ...art('rousseau-equatorial-jungle'), left: 56, top: 646, width: 200, frame: 'rs-oak' },
    { ...art('hokusai-kajikazawa'), left: 290, top: 670, width: 300, frame: 'rs-thin' },
    { ...album, left: 650, top: 666, width: 110, frame: 'rs-sl' },
    { ...album, left: 650, top: 792, width: 110, frame: 'rs-sl' },
    { ...album, left: 224, bottom: 0, width: 150, frame: 'rs-sl', lean: 'rs-lean' },
    { ...art('rousseau-dream'), left: 392, bottom: 0, width: 260, frame: 'rs-thin', lean: 'rs-lean' },
    { ...album, left: 596, bottom: 0, width: 150, frame: 'rs-sl', lean: 'rs-lean2' },
  ],
  'rs-back-t': [{ ...art('matisse-music'), left: 65, top: 46, width: 250, frame: 'rs-thin' }],
  'rs-back-r': [
    { ...art('klee-fugue-in-red'), left: 15, top: 180, width: 110, frame: 'rs-thin' },
    { ...art('lautrec-divan-japonais'), left: 15, top: 290, width: 110, frame: 'rs-black' },
    { ...album, left: 15, top: 470, width: 110, frame: 'rs-sl' },
  ],
  'rw-la': [
    { ...art('matisse-dance'), left: 220, top: 100, width: 300, frame: 'rs-black' },
    { ...art('matisse-harmony-in-red'), left: 40, top: 350, width: 420, frame: 'rs-gilt' },
    { ...art('mucha-arts-music'), left: 310, bottom: 0, width: 170, frame: 'rs-thin', lean: 'rs-lean' },
  ],
  'rw-lt': [{ ...art('munch-sun'), left: 40, top: 36, width: 300, frame: 'rs-thin' }],
  'rw-lb': [
    { ...art('matisse-bonheur-de-vivre'), left: -60, bottom: 0, width: 300, frame: 'rs-thin', lean: 'rs-lean' },
    { ...art('rousseau-sleeping-gypsy'), left: 70, bottom: 0, width: 260, frame: 'rs-thin', lean: 'rs-lean2' },
    { ...art('picasso-demoiselles'), left: 210, bottom: 0, width: 220, frame: 'rs-thin', lean: 'rs-lean3' },
  ],
  'rw-lc': [
    { ...album, left: 20, top: 20, width: 140, frame: 'rs-sl' },
    { ...album, left: 184, top: 30, width: 140, frame: 'rs-sl' },
    { ...art('picasso-three-musicians-philadelphia'), left: 14, top: 186, width: 244, frame: 'rs-gilt' },
    { ...art('klimt-kiss'), left: 14, top: 486, width: 240, frame: 'rs-black' },
    { ...art('russolo-music'), left: 274, top: 200, width: 170, frame: 'rs-oak' },
    { ...art('redon-cyclops'), left: 274, top: 456, width: 170, frame: 'rs-thin' },
  ],
  'rs-right': [
    { ...album, left: 80, top: 54, width: 140, frame: 'rs-sl' },
    { ...art('marc-yellow-cow'), left: 260, top: 30, width: 260, frame: 'rs-thin' },
    { ...art('boccioni-city-rises'), left: 570, top: 46, width: 240, frame: 'rs-gilt' },
    { ...art('gauguin-tahitian-landscape'), left: 60, top: 256, width: 330, frame: 'rs-gilt' },
    { ...art('picasso-three-musicians-moma'), left: 430, top: 236, width: 300, frame: 'rs-black' },
    { ...art('gauguin-arearea'), left: 770, top: 250, width: 240, frame: 'rs-oak' },
    { ...album, left: 60, top: 540, width: 150, frame: 'rs-sl' },
    { ...art('seurat-chahut'), left: 244, top: 530, width: 170, frame: 'rs-thin' },
    { ...art('picasso-femme-nue'), left: 470, top: 536, width: 126, frame: 'rs-thin' },
    { ...art('vangogh-irises'), left: 1040, top: 300, width: 340, frame: 'rs-gilt' },
    { ...art('rousseau-surprised'), left: 810, bottom: 0, width: 250, frame: 'rs-thin', lean: 'rs-lean' },
    { ...art('monet-water-lilies'), left: 940, bottom: 0, width: 220, frame: 'rs-thin', lean: 'rs-lean2' },
  ],
  'rc-unit': [
    { ...album, left: 30, top: 45, width: 130, frame: 'rs-sl', lean: 'rc-on' },
    { ...art('macke-lady-green-jacket'), left: 300, top: 53, width: 120, frame: 'rs-thin', lean: 'rc-on' },
    { ...album, left: 150, top: 225, width: 130, frame: 'rs-sl', lean: 'rc-on' },
    { ...art('picasso-three-dancers'), left: 392, top: 219, width: 90, frame: 'rs-thin', lean: 'rc-on' },
    { ...album, left: 40, top: 410, width: 130, frame: 'rs-sl', lean: 'rc-on' },
    { ...album, left: 330, top: 410, width: 130, frame: 'rs-sl', lean: 'rc-on' },
  ],
  trunk: [
    { ...album, left: 28, top: -130, width: 130, frame: 'rs-sl', ...onFurniture('translateZ(-95px) rotateX(10deg)') },
    {
      ...art('matisse-luxe-calme-volupte'),
      left: 124,
      top: -41,
      width: 200,
      frame: 'rs-oak',
      ...onFurniture('translateZ(46px) rotateX(14deg)'),
    },
  ],
  crate1: [
    { ...album, left: 6, top: -52, width: 158, frame: 'rs-sl', ...onFurniture('translateZ(-16px) rotateX(-8deg)') },
    { ...album, left: -40, top: 0, width: 150, frame: 'rs-sl', ...onFurniture('translateZ(46px) rotateX(16deg)') },
    { ...album, left: 34, top: 0, width: 150, frame: 'rs-sl', ...onFurniture('translateZ(86px) rotateX(15deg)') },
    { ...album, left: -136, top: 0, width: 150, frame: 'rs-sl', ...onFurniture('translateZ(100px) rotateX(15deg)') },
  ],
  crate2: [
    { ...album, left: 6, top: -44, width: 138, frame: 'rs-sl', ...onFurniture('translateZ(-16px) rotateX(-8deg)') },
  ],
};

// The painting seen through both windows. The back window shows it as a
// clickable piece; the left window shows a mirrored, decorative copy.
export const WINDOW_VIEW_ID = 'vangogh-wheat-field-cypresses';

// Order in which album slots are filled (and the order of HANGING above).
export const PLANE_ORDER: PlaneId[] = [
  'rs-back-l',
  'rs-back-t',
  'rs-back-r',
  'rw-la',
  'rw-lt',
  'rw-lb',
  'rw-lc',
  'rs-right',
  'rc-unit',
  'trunk',
  'crate1',
  'crate2',
];

// Every art id in hanging order, the window view last: the order of the art
// strip on the flat page.
export const STRIP_ART_IDS: string[] = [
  ...PLANE_ORDER.flatMap((p) => HANGING[p].flatMap((s) => (s.kind === 'art' ? [s.id] : []))),
  WINDOW_VIEW_ID,
];

export const ALBUM_SLOT_COUNT = PLANE_ORDER.reduce(
  (n, p) => n + HANGING[p].filter((s) => s.kind === 'album').length,
  0
);
