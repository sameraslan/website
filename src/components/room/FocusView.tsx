'use client';

/* eslint-disable @next/next/no-img-element -- room images are pre-sized webp files served as they are */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { CLOSE } from './copy';

export interface ImagePiece {
  sleeve?: false;
  src: string; // wall-size image, shown at once
  fullSrc: string; // large image, swapped in once loaded
  width: number; // natural size of fullSrc
  height: number;
  title: string;
  artist: string;
  year: string;
}

// An album with no cover image: shown as a plain white-label sleeve set in type.
export interface SleevePiece {
  sleeve: true;
  title: string;
  artist: string;
  year: string;
}

export type FocusPiece = ImagePiece | SleevePiece;

// The off-white sleeve with artist and title in type. Font sizes follow the
// sleeve's own width (container units), so one component serves every size.
export function WhiteLabel({ artist, title, className }: { artist: string; title: string; className?: string }) {
  return (
    <span className={`gp-wl${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="gp-wl-in">
        <span className="gp-wl-artist">{artist}</span>
        <span className="gp-wl-title">{title}</span>
      </span>
    </span>
  );
}

// The focused view: the room dims and one piece is shown large on a cream mat.
// A modal dialog: focus moves to Close on open and back to the opener on close;
// a click anywhere, the Close button or Escape closes it.
export function FocusView({ piece, onClose }: { piece: FocusPiece | null; onClose: () => void }) {
  if (!piece) return null;
  const key = piece.sleeve ? `sleeve:${piece.artist}:${piece.title}` : piece.fullSrc;
  return <FocusDialog key={key} piece={piece} onClose={onClose} />;
}

function FocusDialog({ piece, onClose }: { piece: FocusPiece; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [fullReady, setFullReady] = useState(false);

  // Focus Close on open; give focus back to whatever opened the view on close.
  // The opener is kept in a ref so a re-run of this effect cannot replace it
  // with the Close button.
  useEffect(() => {
    if (!openerRef.current) openerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      const opener = openerRef.current;
      // Wait a frame so the room (or the crate) is no longer inert when focus moves back.
      requestAnimationFrame(() => {
        if (opener && opener.isConnected && !document.querySelector('.gp-fx')) opener.focus({ preventScroll: true });
      });
    };
  }, []);

  // Escape closes; Tab stays on the one control inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        closeRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load the full-size file in the background, then swap it in.
  const fullSrc = piece.sleeve ? '' : piece.fullSrc;
  const wallSrc = piece.sleeve ? '' : piece.src;
  useEffect(() => {
    if (!fullSrc || fullSrc === wallSrc) return;
    let live = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (live) setFullReady(true);
    };
    img.src = fullSrc;
    return () => {
      live = false;
      img.onload = null;
    };
  }, [fullSrc, wallSrc]);

  return (
    <div className="gp-fx" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="gp-fx-card">
        {piece.sleeve ? (
          <WhiteLabel className="gp-fx-sleeve" artist={piece.artist} title={piece.title} />
        ) : (
          <img
            className="gp-fx-img"
            src={fullReady ? piece.fullSrc : piece.src}
            width={piece.width}
            height={piece.height}
            alt={`${piece.artist}, ${piece.title}, ${piece.year}`}
            draggable={false}
            // --nw caps the shown width at 1.25 times the file's natural width.
            style={{ '--ar': `${piece.width} / ${piece.height}`, '--nw': piece.width } as CSSProperties}
          />
        )}
        <p className="gp-fx-title" id={titleId}>
          {piece.title}
        </p>
        <p className="gp-fx-meta">
          {piece.artist}, {piece.year}
        </p>
      </div>
      <button
        ref={closeRef}
        type="button"
        className="gp-btn gp-fx-x"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {CLOSE}
      </button>
    </div>
  );
}
