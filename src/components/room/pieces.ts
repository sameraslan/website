// What each interactive target in the room shows and opens: its caption, its
// accessible name and the focused view's piece. Pure: no DOM.

import { ART, albumSrc, artSrc, type Album, type ArtPiece } from '@/lib/room';
import { CRATE_OPEN_LABEL, CRATE_TITLE } from './copy';
import type { FocusPiece } from './FocusView';
import type { Target } from './gl/scene';
import { WINDOW_VIEW_ID } from './layout';

const ART_BY_ID = new Map(ART.map((a) => [a.id, a]));

export const captionText = (p: { artist: string; title: string; year: string }) => `${p.artist}, ${p.title}, ${p.year}`;

export function artFocus(a: ArtPiece): FocusPiece {
  return { src: artSrc(a.id, 'wall'), fullSrc: artSrc(a.id, 'full'), width: a.width, height: a.height, title: a.title, artist: a.artist, year: a.year };
}

export function albumFocus(a: Album): FocusPiece {
  return { src: albumSrc(a.id, 'wall'), fullSrc: albumSrc(a.id, 'full'), width: a.width, height: a.height, title: a.title, artist: a.artist, year: a.year };
}

// A stable string for a target (React keys, lookups).
export const targetId = (t: Target): string => (t.kind === 'art' ? `art:${t.id}` : t.kind === 'album' ? `album:${t.slot}` : t.kind);

export type TargetInfo =
  | { kind: 'piece'; label: string; caption: string; piece: FocusPiece }
  | { kind: 'crate'; label: string; caption: string };

// What a target is today, or null for an album slot that has no album yet
// (an empty sleeve: no caption, nothing to open, no button).
export function describeTarget(t: Target, albums: readonly (Album | null)[] | null): TargetInfo | null {
  if (t.kind === 'crate') return { kind: 'crate', label: CRATE_OPEN_LABEL, caption: CRATE_TITLE };
  if (t.kind === 'album') {
    const a = albums?.[t.slot] ?? null;
    if (!a) return null;
    const cap = captionText(a);
    return { kind: 'piece', label: cap, caption: cap, piece: albumFocus(a) };
  }
  const a = ART_BY_ID.get(t.kind === 'view' ? WINDOW_VIEW_ID : t.id);
  if (!a) return null;
  const cap = captionText(a);
  return { kind: 'piece', label: cap, caption: cap, piece: artFocus(a) };
}
