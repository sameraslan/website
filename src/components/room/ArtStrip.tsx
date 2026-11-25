'use client';

/* eslint-disable @next/next/no-img-element -- room images are pre-sized webp files served as they are */
import { ART, artSrc, type ArtPiece } from '@/lib/room';
import { ART_STRIP_LABEL } from './copy';
import type { FocusPiece } from './FocusView';
import { STRIP_ART_IDS } from './layout';
import { artFocus } from './pieces';

const ART_BY_ID = new Map(ART.map((a) => [a.id, a]));
const STRIP: ArtPiece[] = STRIP_ART_IDS.flatMap((id) => {
  const a = ART_BY_ID.get(id);
  return a ? [a] : [];
});

// The flat page's art: every piece on the walls in one sideways-scrolling row,
// in hanging order with the window view last. A tap opens the focused view.
export function ArtStrip({ onOpen }: { onOpen: (piece: FocusPiece) => void }) {
  return (
    <ul className="gp-strip" aria-label={ART_STRIP_LABEL}>
      {STRIP.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            className="gp-strip-item"
            aria-label={`${a.artist}, ${a.title}, ${a.year}`}
            onClick={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              onOpen(artFocus(a));
            }}
          >
            <img src={artSrc(a.id, 'wall')} width={a.width} height={a.height} alt="" loading="lazy" decoding="async" draggable={false} />
          </button>
        </li>
      ))}
    </ul>
  );
}
