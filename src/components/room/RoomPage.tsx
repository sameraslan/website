'use client';

import './room.css';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { jost } from './font';
import { dailySeed, type Album, type RoomPost } from '@/lib/room';
import { ArtStrip } from './ArtStrip';
import { FLAT_MEDIA, SCALE_SCRIPT, escapeStep, pickDailyAlbums, shouldStartTour, stageScale, type RoomMode } from './behaviour';
import { BACK_TO_POSTS, CRATE_TITLE, HOME_LINK, LOOK_AROUND, ROOM_LABEL } from './copy';
import { CrateView } from './CrateView';
import { FocusView, type FocusPiece } from './FocusView';
import { LetterBoard } from './LetterBoard';
import { Beams, RoomScene } from './RoomScene';

export type { RoomMode };

// Today's albums for the wall slots. The date is only known in the browser, so
// the server snapshot is null (empty sleeves) and covers arrive after hydration.
let dailyCache: { seed: number; list: Album[] } | null = null;
function getDailyAlbums(): Album[] {
  const now = new Date();
  const seed = dailySeed(now);
  if (!dailyCache || dailyCache.seed !== seed) dailyCache = { seed, list: pickDailyAlbums(now) };
  return dailyCache.list;
}
const noSubscribe = () => () => {};
const serverAlbums = () => null;

function matches(query: string): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia(query).matches;
  } catch {
    return false;
  }
}
const prefersReducedMotion = () => matches('(prefers-reduced-motion: reduce)');

// Whether the flat page is showing. CSS already draws the right page on first
// paint; this follows the same query after mount so the room's motion and
// scaling stay off there. The server snapshot is the room (false).
function subscribeFlat(onChange: () => void) {
  const mq = window.matchMedia(FLAT_MEDIA);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const isFlat = () => matches(FLAT_MEDIA);
const serverFlat = () => false;

// Whether the browser registered the @property rules in room.css (a registered
// property computes to its initial value). Then the camera animates those
// numbers on the main thread (.rs-pa), which keeps Chrome's tile memory in
// budget; elsewhere it keeps the plain transform transition and animation.
function hasRegisteredProps() {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--rs-tr').trim() !== '';
  } catch {
    return false;
  }
}
const serverRegisteredProps = () => false;

// While a dialog is open on the flat page, the page behind must not scroll.
// The body is pinned in place and the scroll position put back on close.
function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const y = window.scrollY;
    const body = document.body.style;
    const saved = { position: body.position, top: body.top, left: body.left, right: body.right, overflow: body.overflow };
    Object.assign(body, { position: 'fixed', top: `${-y}px`, left: '0', right: '0', overflow: 'hidden' });
    return () => {
      Object.assign(body, saved);
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    };
  }, [locked]);
}

// The inline scale script is rendered on the server and kept through
// hydration (server snapshot true); after that the client snapshot drops it.
// A client-side navigation never renders it; the layout effect covers that case.
function ScaleScript() {
  const keep = useSyncExternalStore(
    noSubscribe,
    () => false,
    () => true
  );
  return keep ? <script dangerouslySetInnerHTML={{ __html: SCALE_SCRIPT }} /> : null;
}

// One camera rig: dolly > sway > cam > room. Both stage layers use the same one.
function Rig({ children }: { children: ReactNode }) {
  return (
    <div className="rs-dolly">
      <div className="rs-sway">
        <div className="rs-cam">
          <div className="rs-room">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function RoomPage({ posts }: { posts: RoomPost[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [roomMode, setMode] = useState<RoomMode>('read');
  const flat = useSyncExternalStore(subscribeFlat, isFlat, serverFlat);
  // The flat page has no tour: it always reads.
  const mode: RoomMode = flat ? 'read' : roomMode;
  const [focused, setFocused] = useState<FocusPiece | null>(null);
  const [crateOpen, setCrateOpen] = useState(false);
  // Pointer over the board in reading mode: brings the board forward and holds
  // off the idle switch to the tour.
  const [overBoard, setOverBoard] = useState(false);
  // Keyboard focus inside the board: also holds off the idle switch.
  const boardFocused = useRef(false);
  // The board layer, inert while looking around the room, and the mode button.
  const boardStageRef = useRef<HTMLDivElement>(null);
  const modeButtonRef = useRef<HTMLButtonElement>(null);
  // On a switch between the room and the flat page, pointerleave may never
  // fire, so the hover flag is cleared here (the focus flag in the idle effect).
  const [prevFlat, setPrevFlat] = useState(flat);
  if (prevFlat !== flat) {
    setPrevFlat(flat);
    setOverBoard(false);
  }
  const dailyAlbums = useSyncExternalStore(noSubscribe, getDailyAlbums, serverAlbums);
  const propAnim = useSyncExternalStore(noSubscribe, hasRegisteredProps, serverRegisteredProps);
  // No covers in the (hidden) room on the flat page, so phones never fetch them.
  const albums = flat ? null : dailyAlbums;

  // Time of the last pointer move, key press or click, for the idle switch.
  const lastActivity = useRef(0);
  const live = useRef({ mode, focusOpen: false, crateOpen, overBoard });
  useEffect(() => {
    live.current = { mode, focusOpen: focused !== null, crateOpen, overBoard };
  }, [mode, focused, crateOpen, overBoard]);

  // Cover-scale the 1280 x 900 stage to the viewport (capped so the board fits).
  // The inline script set it before first paint; this keeps it right on resize.
  useLayoutEffect(() => {
    const root = rootRef.current;
    // isFlat() too: during hydration `flat` still holds the server value.
    if (!root || flat || isFlat()) return;
    const apply = () => {
      const { width, height } = root.getBoundingClientRect();
      if (!width || !height) return;
      root.style.setProperty('--rs-scale', String(stageScale(width, height)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(root);
    return () => ro.disconnect();
  }, [flat]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Idle switch: after 10 quiet seconds in reading mode the tour starts.
  useEffect(() => {
    const auto = !flat && !isFlat() && matches('(hover: hover)') && !prefersReducedMotion();
    lastActivity.current = Date.now();
    boardFocused.current = false;
    if (!auto) return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    document.addEventListener('keydown', touch, true);
    document.addEventListener('pointerdown', touch, true);
    document.addEventListener('wheel', touch, { capture: true, passive: true });
    const timer = window.setInterval(() => {
      if (document.hidden) {
        touch();
        return;
      }
      const s = live.current;
      const start = shouldStartTour({
        auto,
        mode: s.mode,
        idleMs: Date.now() - lastActivity.current,
        overBoard: s.overBoard,
        boardFocused: boardFocused.current,
        focusOpen: s.focusOpen,
        crateOpen: s.crateOpen,
        hidden: document.hidden,
      });
      if (start) setMode('explore');
    }, 1000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('keydown', touch, true);
      document.removeEventListener('pointerdown', touch, true);
      document.removeEventListener('wheel', touch, true);
    };
  }, [flat]);

  // Escape: focused view first, then the crate, then back to reading mode.
  // The focused view also closes itself on Escape; both calls agree.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const step = escapeStep({ focusOpen: focused !== null, crateOpen, mode });
      if (step === 'close-focus') setFocused(null);
      else if (step === 'close-crate') setCrateOpen(false);
      else if (step === 'to-read') setMode('read');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focused, crateOpen, mode]);

  // Pointer parallax: --mx and --my in [-1, 1] on the root.
  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    lastActivity.current = Date.now();
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      el.style.setProperty('--mx', clamp(((clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty('--my', clamp(((clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
  }, []);

  const onPointerLeave = useCallback((e: PointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(frame.current);
    e.currentTarget.style.setProperty('--mx', '0');
    e.currentTarget.style.setProperty('--my', '0');
  }, []);

  // A press on the room where there is no picture or crate starts the tour.
  const onRoomPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const t = e.target as Element | null;
    if (t?.closest('figure, [data-crate]')) return;
    // Keep focus inside the board from dropping to the page on this press, so
    // the switch below can hand it to the mode button.
    if (boardStageRef.current?.contains(document.activeElement)) e.preventDefault();
    setMode('explore');
  }, []);

  const onBoardHover = useCallback((over: boolean) => {
    lastActivity.current = Date.now();
    setOverBoard(over);
  }, []);
  // The board is inert outside reading mode, so focus only enters it while reading.
  const onBoardFocus = useCallback(() => {
    boardFocused.current = true;
  }, []);
  const onBoardBlur = useCallback(() => {
    boardFocused.current = false;
    lastActivity.current = Date.now();
  }, []);

  const open = useCallback((piece: FocusPiece) => setFocused(piece), []);
  const close = useCallback(() => setFocused(null), []);
  const openCrate = useCallback(() => setCrateOpen(true), []);
  const closeCrate = useCallback(() => setCrateOpen(false), []);

  const covered = focused !== null || crateOpen;
  const reading = mode === 'read';
  useScrollLock(flat && covered);

  // Looking around the room takes the board away and makes it inert. Focus
  // inside the board at that moment moves to the mode button ("Back to the
  // posts"), before the browser drops it from the now inert board.
  useLayoutEffect(() => {
    if (mode !== 'explore') return;
    if (boardStageRef.current?.contains(document.activeElement)) modeButtonRef.current?.focus({ preventScroll: true });
  }, [mode]);

  return (
    <div
      ref={rootRef}
      className={`rs-root gn-${mode} gp-f-${focused ? 'on' : 'off'}${crateOpen ? ' gp-c-on' : ''}${overBoard ? ' gp-over' : ''}${propAnim ? ' rs-pa' : ''} ${jost.variable}`}
      onPointerMove={flat ? undefined : onPointerMove}
      onPointerLeave={flat ? undefined : onPointerLeave}
      // The inline script sets --rs-scale on this element before hydration.
      suppressHydrationWarning
    >
      <ScaleScript />
      <Link className="gp-home" href="/" inert={covered ? true : undefined}>
        {HOME_LINK}
      </Link>
      {/* The flat page for phones and touch screens: the board, the art in one
          strip and the crate. Shown by CSS only where the room is not, so one
          of the two is always display: none (one h1 in the tree). */}
      <div className="gp-flat" inert={covered ? true : undefined}>
        <LetterBoard posts={posts} />
        <ArtStrip onOpen={open} />
        <button
          type="button"
          className="gp-btn gp-flat-crate"
          aria-haspopup="dialog"
          onClick={(e) => {
            // Safari does not focus a button on click; the crate returns focus to it.
            e.currentTarget.focus({ preventScroll: true });
            openCrate();
          }}
        >
          {CRATE_TITLE}
        </button>
      </div>
      {/* The board layer comes first in the DOM so the title and posts lead the
          tab order; it is stacked above the room with z-index. */}
      <div ref={boardStageRef} className="rs-stage gp-stage2" inert={covered || !reading ? true : undefined}>
        <Rig>
          <Beams />
          <LetterBoard posts={posts} onHoverChange={onBoardHover} onFocusIn={onBoardFocus} onFocusOut={onBoardBlur} />
        </Rig>
      </div>
      <div
        className="rs-stage rs-stage-room"
        role="group"
        aria-label={ROOM_LABEL}
        inert={covered ? true : undefined}
        onPointerDown={onRoomPointerDown}
      >
        <Rig>
          <RoomScene albums={albums} onOpen={open} onOpenCrate={openCrate} />
        </Rig>
      </div>

      <div className="rs-vignette" aria-hidden="true" />
      <svg className="rs-grain" aria-hidden="true" width="100%" height="100%">
        <filter id="rs-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#rs-grain)" />
      </svg>

      <div className="gp-ctl" inert={covered ? true : undefined}>
        <button ref={modeButtonRef} type="button" className={`gp-btn ${reading ? 'gp-look' : 'gp-back'}`} onClick={() => setMode(reading ? 'explore' : 'read')}>
          {reading ? LOOK_AROUND : BACK_TO_POSTS}
        </button>
      </div>

      <CrateView open={crateOpen} covered={focused !== null} onClose={closeCrate} onOpenAlbum={open} />
      <FocusView piece={focused} onClose={close} />
    </div>
  );
}
