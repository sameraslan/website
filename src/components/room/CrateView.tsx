'use client';

/* eslint-disable @next/next/no-img-element -- room images are pre-sized webp files served as they are */
import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { CRATE_ALBUMS, albumSrc, type Album } from '@/lib/room';
import { CLOSE, CRATE_GRID_LABEL, CRATE_TITLE } from './copy';
import { WhiteLabel, type FocusPiece } from './FocusView';

export function albumPiece(a: Album): FocusPiece {
  if (!a.hasCover) return { sleeve: true, title: a.title, artist: a.artist, year: a.year };
  return { src: albumSrc(a.id, 'wall'), fullSrc: albumSrc(a.id, 'full'), width: a.width, height: a.height, title: a.title, artist: a.artist, year: a.year };
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// The record crate: every album, by artist, in a scrollable grid over the
// dimmed room. A modal dialog like the focused view. Escape is handled by the
// page (it closes the focused view first when one is open on top). While
// `covered` is true the focused view sits on top and this dialog is inert.
export function CrateView({
  open,
  covered,
  onClose,
  onOpenAlbum,
}: {
  open: boolean;
  covered: boolean;
  onClose: () => void;
  onOpenAlbum: (piece: FocusPiece) => void;
}) {
  if (!open) return null;
  return <CrateDialog covered={covered} onClose={onClose} onOpenAlbum={onOpenAlbum} />;
}

function CrateDialog({ covered, onClose, onOpenAlbum }: { covered: boolean; onClose: () => void; onOpenAlbum: (piece: FocusPiece) => void }) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Focus Close on open; give focus back to the crate in the room on close.
  useEffect(() => {
    if (!openerRef.current) openerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      const opener = openerRef.current;
      requestAnimationFrame(() => {
        if (opener && opener.isConnected && !document.querySelector('.gp-cr, .gp-fx')) opener.focus({ preventScroll: true });
      });
    };
  }, []);

  // Tab and Shift+Tab cycle through the controls inside the dialog.
  useEffect(() => {
    if (covered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !rootRef.current) return;
      const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && rootRef.current.contains(active);
      if (!inside) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [covered]);

  const onBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div ref={rootRef} className="gp-cr" role="dialog" aria-modal="true" aria-labelledby={titleId} inert={covered ? true : undefined} onClick={onBackdrop}>
      <div className="gp-cr-panel">
        <div className="gp-cr-head">
          <h2 className="gp-cr-title" id={titleId}>
            {CRATE_TITLE}
          </h2>
          <button ref={closeRef} type="button" className="gp-btn" onClick={onClose}>
            {CLOSE}
          </button>
        </div>
        <ul className="gp-cr-grid" aria-label={CRATE_GRID_LABEL}>
          {CRATE_ALBUMS.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="gp-cr-item"
                aria-label={`${a.artist}, ${a.title}, ${a.year}`}
                onClick={(e) => {
                  e.currentTarget.focus({ preventScroll: true });
                  onOpenAlbum(albumPiece(a));
                }}
              >
                {a.hasCover ? (
                  <img
                    className="gp-cr-cover"
                    src={albumSrc(a.id, 'wall')}
                    width={a.width}
                    height={a.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <WhiteLabel className="gp-cr-cover" artist={a.artist} title={a.title} />
                )}
                <span className="gp-cr-artist">{a.artist}</span>
                <span className="gp-cr-name">{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
