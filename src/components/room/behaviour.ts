// Pure rules for the /notes room: stage scale, the idle switch to the room
// tour, and what Escape does. Kept free of React and the DOM so they can be
// unit tested.

import { ALBUMS, dailySeed, seededShuffle, type Album } from '@/lib/room';
import { ALBUM_SLOT_COUNT } from './layout';

export type RoomMode = 'read' | 'explore';

// Phones, touch screens and narrow windows get the flat page instead of the
// 3D room. CSS decides it (room.css uses this same query); JS reads it after
// mount only to keep the tour, idle timer, parallax and stage scale off.
export const FLAT_MEDIA = '(max-width: 760px), (pointer: coarse)';

export const STAGE_W = 1280;
export const STAGE_H = 900;

// Half the stage height the board needs, measured from the stage centre
// (y 450), frame and a small margin included. Cover scaling crops the stage
// vertically in very wide windows; the scale is capped so this band stays in view.
export const BOARD_HALF_SPAN = 288;

// The scale as a JS expression of w and h, shared by stageScale() and the
// inline script that sets --rs-scale before first paint.
export const SCALE_EXPR = `Math.min(Math.max(w / ${STAGE_W}, h / ${STAGE_H}), h / ${2 * BOARD_HALF_SPAN})`;

export function stageScale(w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return 1;
  return Math.min(Math.max(w / STAGE_W, h / STAGE_H), h / (2 * BOARD_HALF_SPAN));
}

// Runs inline, right after the room root opens, so the first paint already has
// the right scale in every browser. Without JS the stage stays at scale 1.
// On the flat page there is no stage to scale, so it does nothing.
export const SCALE_SCRIPT = `(function(){try{if(window.matchMedia&&window.matchMedia('${FLAT_MEDIA}').matches)return;var r=document.currentScript&&document.currentScript.parentNode;if(!r||!r.style)return;var b=r.getBoundingClientRect(),w=b.width||window.innerWidth,h=b.height||window.innerHeight;if(w>0&&h>0)r.style.setProperty('--rs-scale',String(${SCALE_EXPR}))}catch(e){}})();`;

export const IDLE_MS = 10_000;

export interface IdleState {
  auto: boolean; // (hover: hover) and no reduced-motion request
  mode: RoomMode;
  idleMs: number; // time since the last pointer move, key press or click
  overBoard: boolean;
  boardFocused: boolean; // keyboard focus is inside the board
  focusOpen: boolean;
  crateOpen: boolean;
  hidden: boolean; // document.hidden
}

// True when reading mode should hand over to the room tour by itself.
export function shouldStartTour(s: IdleState): boolean {
  return s.auto && s.mode === 'read' && !s.hidden && !s.overBoard && !s.boardFocused && !s.focusOpen && !s.crateOpen && s.idleMs >= IDLE_MS;
}

export type EscapeStep = 'close-focus' | 'close-crate' | 'to-read' | 'none';

// Escape closes the innermost layer first: focused view, then crate, then the tour.
export function escapeStep(s: { focusOpen: boolean; crateOpen: boolean; mode: RoomMode }): EscapeStep {
  if (s.focusOpen) return 'close-focus';
  if (s.crateOpen) return 'close-crate';
  if (s.mode === 'explore') return 'to-read';
  return 'none';
}

// Today's albums for the wall slots: a shuffle of the albums with a cover,
// seeded by the date, so everyone sees the same wall on the same day.
export function pickDailyAlbums(date: Date): Album[] {
  return seededShuffle(
    ALBUMS.filter((a) => a.hasCover),
    dailySeed(date)
  ).slice(0, ALBUM_SLOT_COUNT);
}
