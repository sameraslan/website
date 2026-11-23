'use client';

/* eslint-disable @next/next/no-img-element -- room images are pre-sized webp files served as they are */
import { memo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ART, albumSrc, artSrc, type Album, type ArtPiece } from '@/lib/room';
import { CRATE_OPEN_LABEL, CRATE_TITLE } from './copy';
import type { FocusPiece } from './FocusView';
import { ROOM_MEDIA } from './behaviour';
import { HANGING, PLANE_ORDER, WINDOW_VIEW_ID, type PlaneId, type Slot } from './layout';

export type OpenPiece = (piece: FocusPiece, from: HTMLElement) => void;

const ART_BY_ID = new Map(ART.map((a) => [a.id, a]));

function artById(id: string): ArtPiece {
  const piece = ART_BY_ID.get(id);
  if (!piece) throw new Error(`Unknown art id in the hanging plan: ${id}`);
  return piece;
}

// Index of the first album slot on each plane, so slots map onto the daily list.
const ALBUM_OFFSET = (() => {
  const out = {} as Record<PlaneId, number>;
  let n = 0;
  for (const p of PLANE_ORDER) {
    out[p] = n;
    n += HANGING[p].filter((s) => s.kind === 'album').length;
  }
  return out;
})();

const caption = (p: { artist: string; title: string; year: string }) => `${p.artist}, ${p.title}, ${p.year}`;

export function artFocus(a: ArtPiece): FocusPiece {
  return { src: artSrc(a.id, 'wall'), fullSrc: artSrc(a.id, 'full'), width: a.width, height: a.height, title: a.title, artist: a.artist, year: a.year };
}

function albumFocus(a: Album): FocusPiece {
  return { src: albumSrc(a.id, 'wall'), fullSrc: albumSrc(a.id, 'full'), width: a.width, height: a.height, title: a.title, artist: a.artist, year: a.year };
}

// A transparent pixel: what the room's images show where the room is not drawn.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// An image of the 3D room. The browser picks the real file only when the room
// media query matches, so the flat page (phones, touch screens) never fetches
// it, while on desktop the preload scanner still finds it early.
function RoomImg(props: { src: string; width?: number; height?: number; alt: string; className?: string; style?: CSSProperties }) {
  const { src, alt, ...rest } = props;
  return (
    <picture>
      <source media={ROOM_MEDIA} srcSet={src} />
      <img src={BLANK} alt={alt} {...rest} decoding="async" draggable={false} />
    </picture>
  );
}

function slotStyle(s: Slot): CSSProperties {
  return { left: s.left, top: s.top, bottom: s.bottom, width: s.width, transform: s.transform, transformOrigin: s.transformOrigin };
}

// Click, Enter or Space on a focused figure opens it.
function openers(piece: FocusPiece, onOpen: OpenPiece) {
  return {
    tabIndex: 0,
    role: 'button',
    onClick: (e: { currentTarget: HTMLElement }) => {
      e.currentTarget.focus({ preventScroll: true });
      onOpen(piece, e.currentTarget);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(piece, e.currentTarget);
      }
    },
  };
}

function ArtFigure({ slot, id, onOpen }: { slot: Slot; id: string; onOpen: OpenPiece }) {
  const a = artById(id);
  const cap = caption(a);
  return (
    <figure className={`rs-pc ${slot.frame}${slot.lean ? ` ${slot.lean}` : ''}`} style={slotStyle(slot)} aria-label={cap} {...openers(artFocus(a), onOpen)}>
      <RoomImg src={artSrc(a.id, 'wall')} width={a.width} height={a.height} alt={cap} />
      <figcaption>{cap}</figcaption>
    </figure>
  );
}

function AlbumCover({ album }: { album: Album }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      key={album.id}
      className={loaded ? 'is-loaded' : undefined}
      src={albumSrc(album.id, 'wall')}
      width={album.width}
      height={album.height}
      alt={caption(album)}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
      ref={(el) => {
        if (el && el.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
      }}
    />
  );
}

function AlbumFigure({ slot, album, onOpen }: { slot: Slot; album: Album | null; onOpen: OpenPiece }) {
  const className = `rs-pc ${slot.frame}${slot.lean ? ` ${slot.lean}` : ''}`;
  if (!album) {
    return (
      <figure className={className} style={slotStyle(slot)} aria-hidden="true">
        <span className="rs-sleeve" />
      </figure>
    );
  }
  const cap = caption(album);
  return (
    <figure className={className} style={slotStyle(slot)} aria-label={cap} {...openers(albumFocus(album), onOpen)}>
      <span className="rs-sleeve">
        <AlbumCover key={album.id} album={album} />
      </span>
      <figcaption>{cap}</figcaption>
    </figure>
  );
}

function Slots({ plane, albums, onOpen }: { plane: PlaneId; albums: Album[] | null; onOpen: OpenPiece }) {
  let albumIndex = ALBUM_OFFSET[plane];
  const out: ReactNode[] = [];
  HANGING[plane].forEach((slot, i) => {
    if (slot.kind === 'art') {
      out.push(<ArtFigure key={`${plane}-${i}`} slot={slot} id={slot.id} onOpen={onOpen} />);
    } else {
      const album = albums ? (albums[albumIndex] ?? null) : null;
      albumIndex += 1;
      out.push(<AlbumFigure key={`${plane}-${i}`} slot={slot} album={album} onOpen={onOpen} />);
    }
  });
  return <>{out}</>;
}

// Ceiling beams. They render in the foreground layer with the board: in the
// room layer, Chrome mis-sorted the plane of their undersides against the stone
// above the back window and painted a strip of wall across the picture there.
export function Beams() {
  return (
    <>
      <Beam z={100} />
      <Beam z={-150} />
      <Beam z={-400} />
      <Beam z={-650} />
    </>
  );
}

function Beam({ z }: { z: number }) {
  return (
    <div className="rs-box" style={{ transform: `translate3d(-650px, -640px, ${z}px)` }}>
      <div className="rs-face rc-beam" style={{ width: 1300, height: 110 }} />
      <div className="rs-face rc-beam-under" style={{ top: 110, width: 1300, height: 90, transformOrigin: '0 0', transform: 'rotateX(-90deg)' }} />
    </div>
  );
}

function Mullions() {
  return (
    <>
      <div className="rc-mullion-v" />
      <div className="rc-mullion-h" />
    </>
  );
}

const shade = (background: string, extra?: CSSProperties) => <div className="rs-shade" style={{ background, ...extra }} />;

const SHELF_SIDE = (light: string, dark: string, fill: string): CSSProperties => ({
  position: 'absolute',
  top: 0,
  width: 60,
  height: 560,
  boxSizing: 'border-box',
  borderLeft: `12px solid ${light}`,
  borderRight: `12px solid ${dark}`,
  background: `linear-gradient(180deg, ${fill} 0 16px, rgba(0,0,0,0) 16px 175px, ${fill} 175px 191px, rgba(0,0,0,0) 191px 355px, ${fill} 355px 371px, rgba(0,0,0,0) 371px 540px, ${fill} 540px 560px)`,
  transformOrigin: '0 0',
  transform: 'rotateY(90deg)',
});

const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });
const TOP_FACE = { transformOrigin: '0 0', transform: 'rotateX(-90deg)' } as const;
const SIDE_FACE = { transformOrigin: '0 0', transform: 'rotateY(90deg)' } as const;

// A record crate. The box holds 3D faces and the albums standing in it, so the
// control lives on the leaf faces: the front face is the focusable button and
// the top and side faces take clicks too. The caption shows on hover or focus.
function Crate({
  transform,
  width,
  height,
  depth,
  stripes,
  caption,
  onOpenCrate,
  children,
}: {
  transform: string;
  caption: { y: number; z: number }; // caption spot in the box, above the albums in it
  width: number;
  height: number;
  depth: number;
  stripes: string;
  onOpenCrate: () => void;
  children: ReactNode;
}) {
  const [hot, setHot] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const open = () => {
    frontRef.current?.focus({ preventScroll: true });
    onOpenCrate();
  };
  const face = { 'data-crate': '', onClick: open, onPointerEnter: () => setHot(true), onPointerLeave: () => setHot(false) };
  return (
    <div className={`rs-box rc-crate${hot ? ' is-hot' : ''}`} style={{ transform }}>
      <div
        ref={frontRef}
        className="rs-face rc-oak rc-crate-face rc-crate-front"
        role="button"
        tabIndex={0}
        aria-label={CRATE_OPEN_LABEL}
        aria-haspopup="dialog"
        style={{ width, height, boxShadow: 'inset 0 0 0 6px rgba(0,0,0,.22)' }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        {...face}
      />
      <div className="rs-face rc-crate-face" aria-hidden="true" style={{ width, height: depth, ...TOP_FACE, background: stripes }} {...face} />
      <div className="rs-face rc-oak-dark rc-crate-face" aria-hidden="true" style={{ width: depth, height, ...SIDE_FACE }} {...face} />
      {children}
      {/* A sibling in the box so it sits in front of the albums standing in the crate. */}
      <span className="rc-crate-cap" aria-hidden="true" style={{ transform: `translate3d(0, ${caption.y}px, ${caption.z}px) translateY(-100%)` }}>
        {CRATE_TITLE}
      </span>
    </div>
  );
}

// The room itself: planes, furniture, light, and every hung piece from the plan.
export const RoomScene = memo(function RoomScene({
  albums,
  onOpen,
  onOpenCrate,
}: {
  albums: Album[] | null;
  onOpen: OpenPiece;
  onOpenCrate: () => void;
}) {
  const view = artById(WINDOW_VIEW_ID);
  const viewCap = caption(view);
  const s = (plane: PlaneId) => <Slots plane={plane} albums={albums} onOpen={onOpen} />;

  return (
    <>
      <figure
        className="rs-pc rw-vg"
        style={{ left: -365, top: -570, width: 1200, transform: 'translateZ(-1660px)' }}
        aria-label={viewCap}
        {...openers(artFocus(view), onOpen)}
      >
        <RoomImg src={artSrc(view.id, 'wall')} width={view.width} height={view.height} alt={viewCap} />
        <figcaption>{viewCap}</figcaption>
      </figure>

      <div className="rs-plane rw-view" aria-hidden="true">
        <RoomImg src={artSrc(view.id, 'wall')} width={view.width} height={view.height} alt="" />
      </div>

      <div className="rs-plane rs-floor rc-planks">
        <RoomImg className="rc-rug" src="/images/room/rugs/rug-kilim.webp" width={417} height={1100} alt="" style={{ left: 500, top: 330, width: 300 }} />
        <RoomImg
          className="rc-rug"
          src="/images/room/rugs/rug-persian-red.webp"
          width={762}
          height={1100}
          alt=""
          style={{ left: 880, top: 540, width: 320, transform: 'translateZ(1px) rotate(12deg)' }}
        />
        <div className="rw-shaft rw-shaft-b" />
        <div className="rw-shaft rw-shaft-l" />
        {shade(
          'radial-gradient(ellipse 26% 22% at 78% 36%, rgba(255,240,205,.16), rgba(255,240,205,0) 70%), radial-gradient(ellipse 24% 22% at 40% 50%, rgba(255,240,205,.14), rgba(255,240,205,0) 70%), radial-gradient(ellipse 26% 18% at 52% 40%, rgba(255,180,100,.06), rgba(255,180,100,0) 70%), radial-gradient(ellipse 20% 7% at 50% 44%, rgba(0,0,0,.34), rgba(0,0,0,0) 72%), radial-gradient(ellipse 6% 22% at 24% 27%, rgba(0,0,0,.3), rgba(0,0,0,0) 75%), radial-gradient(ellipse 10% 16% at 86% 44%, rgba(0,0,0,.3), rgba(0,0,0,0) 75%), radial-gradient(ellipse 14% 8% at 75% 9%, rgba(0,0,0,.3), rgba(0,0,0,0) 75%), linear-gradient(90deg, rgba(0,0,0,.24), rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,.24)), linear-gradient(180deg, rgba(255,240,205,.06), rgba(0,0,0,0) 30%, rgba(0,0,0,.16) 100%)',
          { transform: 'translateZ(3px)' }
        )}
      </div>

      <div className="rs-plane rs-ceil rc-ceilwood">
        {shade('radial-gradient(ellipse 40% 30% at 52% 60%, rgba(255,180,100,.05), rgba(255,180,100,0) 70%), linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.04) 60%, rgba(0,0,0,.14))')}
      </div>

      <div className="rs-plane rc-stone rs-back-l">
        {shade(
          'radial-gradient(ellipse 42% 46% at 122% 46%, rgba(255,240,205,.32), rgba(255,240,205,0) 70%), radial-gradient(ellipse 50% 30% at 46% 52%, rgba(255,236,200,.08), rgba(255,236,200,0) 70%), linear-gradient(180deg, rgba(40,26,14,.2), rgba(40,26,14,.02) 26%, rgba(40,26,14,.02) 74%, rgba(40,26,14,.22)), linear-gradient(90deg, rgba(40,26,14,.14), rgba(40,26,14,0) 30%)'
        )}
        <div className="rw-wains" />
        <div className="rw-rail" />
        {s('rs-back-l')}
      </div>

      <div className="rs-plane rc-stone rs-back-t">
        {shade('radial-gradient(ellipse 70% 80% at 50% 120%, rgba(255,240,205,.36), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(40,26,14,.2), rgba(40,26,14,.02))')}
        {s('rs-back-t')}
      </div>
      <div className="rs-plane rc-stone rs-back-b">
        {shade('radial-gradient(ellipse 70% 60% at 50% -14%, rgba(255,240,205,.3), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(40,26,14,.02), rgba(40,26,14,.22))')}
        <div className="rw-wains" style={{ backgroundPosition: '-780px 0' }} />
        <div className="rw-rail" />
      </div>
      <div className="rs-plane rc-stone rs-back-r">
        {shade(
          'radial-gradient(ellipse 120% 40% at -40% 46%, rgba(255,240,205,.32), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(40,26,14,.2), rgba(40,26,14,.02) 26%, rgba(40,26,14,.02) 74%, rgba(40,26,14,.22))'
        )}
        <div className="rw-wains" style={{ backgroundPosition: '-1160px 0' }} />
        <div className="rw-rail" />
        {s('rs-back-r')}
      </div>

      <div className="rs-plane rc-reveal rc-jamb-l" />
      <div className="rs-plane rc-reveal-lit rc-jamb-r">
        <div className="rw-glow" style={{ background: 'linear-gradient(90deg, rgba(255,244,214,.5), rgba(255,244,214,.1))' }} />
      </div>
      <div className="rs-plane rc-reveal rc-head" />
      <div className="rs-plane rc-oak-top rc-sill">
        <div className="rw-glow" style={{ background: 'linear-gradient(180deg, rgba(255,244,214,.5), rgba(255,244,214,.12))' }} />
      </div>
      <div className="rs-plane rc-frame">
        <Mullions />
      </div>

      <div className="rs-plane rc-timber rw-la">
        {shade(
          'radial-gradient(ellipse 46% 40% at 108% 44%, rgba(255,240,205,.2), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.26))'
        )}
        {s('rw-la')}
      </div>

      <div className="rs-plane rc-timber rw-lt">
        {shade('radial-gradient(ellipse 70% 80% at 50% 124%, rgba(255,240,205,.22), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0))')}
        {s('rw-lt')}
      </div>

      <div className="rs-plane rc-timber rw-lb">
        {shade('radial-gradient(ellipse 70% 50% at 50% -12%, rgba(255,240,205,.18), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,0) 36%, rgba(0,0,0,.26))')}
        <div className="rc-oak-dark" style={abs({ left: 0, top: 0, width: 380, height: 10, transform: 'translateZ(24px)' })} />
        {s('rw-lb')}
      </div>

      <div className="rs-plane rc-timber rw-lc">
        {shade(
          'radial-gradient(ellipse 46% 40% at -8% 44%, rgba(255,240,205,.2), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.26))'
        )}
        {s('rw-lc')}
      </div>

      <div className="rs-plane rw-reveal rw-jamb-n" />
      <div className="rs-plane rw-reveal-lit rw-jamb-f">
        <div className="rw-glow" style={{ background: 'linear-gradient(90deg, rgba(255,244,214,.46), rgba(255,244,214,.08))' }} />
      </div>
      <div className="rs-plane rw-reveal rw-head">
        <div className="rw-glow" style={{ background: 'linear-gradient(90deg, rgba(255,244,214,.2), rgba(255,244,214,0))' }} />
      </div>
      <div className="rs-plane rc-oak-top rw-sill">
        <div className="rw-glow" style={{ background: 'linear-gradient(90deg, rgba(255,244,214,.5), rgba(255,244,214,.12))' }} />
      </div>
      <div className="rs-plane rw-frame">
        <Mullions />
      </div>

      <div className="rs-plane rc-timber rs-right">
        {shade(
          'radial-gradient(ellipse 22% 34% at 16% 40%, rgba(255,240,205,.14), rgba(255,240,205,0) 70%), radial-gradient(ellipse 22% 34% at 42% 38%, rgba(255,240,205,.16), rgba(255,240,205,0) 70%), radial-gradient(ellipse 20% 30% at 64% 36%, rgba(255,240,205,.16), rgba(255,240,205,0) 70%), radial-gradient(ellipse 22% 34% at 86% 46%, rgba(255,240,205,.1), rgba(255,240,205,0) 70%), linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,.26))'
        )}
        {s('rs-right')}
      </div>

      <div className="rs-plane rc-unit">
        <div className="rc-oak-dark" style={abs({ left: 0, top: 0, width: 16, height: 560 })} />
        <div className="rc-oak-dark" style={abs({ left: 262, top: 0, width: 16, height: 560 })} />
        <div className="rc-oak-dark" style={abs({ left: 524, top: 0, width: 16, height: 560 })} />
        <div className="rc-oak-deep" style={abs({ left: 0, top: 0, width: 16, height: 560, transform: 'translateZ(-60px)' })} />
        <div className="rc-oak-deep" style={abs({ left: 262, top: 0, width: 16, height: 560, transform: 'translateZ(-60px)' })} />
        <div className="rc-oak-deep" style={abs({ left: 524, top: 0, width: 16, height: 560, transform: 'translateZ(-60px)' })} />
        <div style={{ ...SHELF_SIDE('#6b4c2e', '#4a3320', '#5a3f27'), left: 0 }} />
        <div style={{ ...SHELF_SIDE('#4a3320', '#33231a', '#3d2a18'), left: 540 }} />
        {[0, 175, 355, 540].map((top) => (
          <div key={`top-${top}`} className="rc-oak-top" style={abs({ left: 0, top, width: 540, height: 60, ...TOP_FACE })} />
        ))}
        {[0, 175, 355, 540].map((top) => (
          <div key={`edge-${top}`} className="rc-oak-dark" style={abs({ left: 0, top, width: 540, height: top === 540 ? 20 : 16 })} />
        ))}
        {s('rc-unit')}
      </div>

      {/* Bench */}
      <div className="rs-box" style={{ transform: 'translate3d(-200px, 300px, -330px)' }}>
        <div className="rs-face rc-oak" style={{ width: 400, height: 24 }} />
        <div className="rs-face rc-oak-top" style={{ width: 400, height: 120, ...TOP_FACE }} />
        <div className="rs-face rc-oak-deep" style={{ width: 120, height: 24, ...SIDE_FACE }} />
        <div className="rs-face rc-oak-dark" style={{ left: 400, width: 120, height: 24, ...SIDE_FACE }} />
      </div>
      <div className="rs-box" style={{ transform: 'translate3d(-180px, 324px, -340px)' }}>
        <div className="rs-face rc-oak-dark" style={{ width: 28, height: 56 }} />
        <div className="rs-face rc-oak-deep" style={{ width: 100, height: 56, ...SIDE_FACE }} />
        <div className="rs-face rc-oak-dark" style={{ left: 28, width: 100, height: 56, ...SIDE_FACE }} />
      </div>
      <div className="rs-box" style={{ transform: 'translate3d(152px, 324px, -340px)' }}>
        <div className="rs-face rc-oak-dark" style={{ width: 28, height: 56 }} />
        <div className="rs-face rc-oak-dark" style={{ width: 100, height: 56, ...SIDE_FACE }} />
        <div className="rs-face rc-oak-deep" style={{ left: 28, width: 100, height: 56, ...SIDE_FACE }} />
      </div>

      {/* Trunk */}
      <div className="rs-box" style={{ transform: 'translate3d(180px, 250px, -820px)' }}>
        <div className="rs-face rc-trunk" style={{ width: 300, height: 130, boxShadow: 'inset 0 0 0 5px rgba(0,0,0,.28)' }} />
        <div className="rs-face rc-trunk" style={{ width: 300, height: 150, ...TOP_FACE }} />
        <div className="rs-face rc-trunk-side" style={{ width: 150, height: 130, ...SIDE_FACE }} />
        {s('trunk')}
      </div>

      {/* Record crates: each opens the crate dialog with all the albums. */}
      <Crate
        transform="translate3d(450px, 230px, -200px)"
        width={170}
        height={150}
        depth={380}
        caption={{ y: -100, z: 110 }}
        stripes="repeating-linear-gradient(180deg, #e9dfcc 0 3px, #1a1416 3px 5px, #c8452c 5px 8px, #1a1416 8px 10px, #e3a72f 10px 13px, #1a1416 13px 15px, #2438c9 15px 18px, #1a1416 18px 20px, #f1e9da 20px 23px, #1a1416 23px 25px, #1f8a8a 25px 28px, #1a1416 28px 31px)"
        onOpenCrate={onOpenCrate}
      >
        {s('crate1')}
      </Crate>
      <Crate
        transform="translate3d(480px, 250px, -650px)"
        width={150}
        height={130}
        depth={240}
        caption={{ y: -150, z: 10 }}
        stripes="repeating-linear-gradient(180deg, #f1e9da 0 3px, #1a1416 3px 5px, #2f6b4a 5px 8px, #1a1416 8px 10px, #d9662b 10px 13px, #1a1416 13px 15px, #e9dfcc 15px 18px, #1a1416 18px 20px, #7a2e52 20px 23px, #1a1416 23px 26px)"
        onOpenCrate={onOpenCrate}
      >
        {s('crate2')}
      </Crate>

      {/* Hanging lamp */}
      <div className="rs-box" style={{ transform: 'translate3d(12px, -530px, -445px)' }}>
        <div className="rs-face" style={{ left: 27, width: 2, height: 190, background: '#140d08' }} />
        <div
          className="rs-face"
          style={{
            top: 190,
            width: 56,
            height: 84,
            boxSizing: 'border-box',
            border: '4px solid #22160d',
            borderRadius: 6,
            background: 'radial-gradient(ellipse 60% 55% at 50% 55%, #fff3cf 0%, #ffcf7a 38%, #e08a2c 78%, #7a4414 100%)',
            boxShadow: '0 0 70px 34px rgba(255,176,90,.11), 0 0 18px 6px rgba(255,210,140,.17)',
          }}
        />
      </div>
    </>
  );
});
