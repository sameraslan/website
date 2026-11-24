'use client';

// The room as one WebGL canvas (gl/RoomCanvas), inside the room group that
// covers the .rs-root box, and what makes it interactive: pointer hover
// (picked in JS against the scene), the DOM captions in their own stage layer,
// clicks that open a picture or the crate, and one visually hidden button per
// target (ul.rs-proxies) for the keyboard and screen readers. The canvas follows the camera
// rig of the board stage. The caption stage and its rig are rendered by the
// page from the server render on, next to the board stage, so both rigs start
// their load-in animation together; the captions go into it through a portal.
// Board, captions and room share one camera.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type Ref, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Album } from '@/lib/room';
import { ROOM_LABEL } from './copy';
import type { FocusPiece } from './FocusView';
import { describeTarget, targetId } from './pieces';
import type { Mat4 } from './gl/mat4';
import { hitTest } from './gl/pick';
import { RoomCanvas, type RoomCanvasHandle } from './gl/RoomCanvas';
import { buildScene, type Caption, type Scene, type Target } from './gl/scene';
import { captionTransform, clampBox, crateIndex, projectedBox, targetQuads } from './gl/targets';

// One camera rig: dolly > sway > cam > room. Every stage layer uses the same one.
export function Rig({ children, roomRef }: { children?: ReactNode; roomRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="rs-dolly">
      <div className="rs-sway">
        <div className="rs-cam">
          <div className="rs-room" ref={roomRef}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// What the pointer is over: a picture's quad key (or crate:<n> for a crate)
// and its target.
type Hot = { key: string; target: Target };

// A caption in the caption layer: its text and where it sits, in the frame
// of the quad it follows (`follow`, whose matrix moves with the hover lift)
// or in the fixed frame `matrix` (crates).
type Cap = {
  id: string;
  text: string;
  caption: Caption;
  follow: string | null;
  matrix: Mat4;
};

function hotFromKey(key: string, target: Target): Hot {
  const crate = crateIndex(key);
  return target.kind === 'crate' && crate >= 0 ? { key: `crate:${crate}`, target } : { key, target };
}

function captionFor(hot: Hot, scene: Scene, albums: Album[] | null): Cap | null {
  const info = describeTarget(hot.target, albums);
  if (!info) return null;
  if (hot.target.kind === 'crate') {
    const c = scene.crateCaptions[Number(hot.key.slice('crate:'.length))];
    return c
      ? {
          id: hot.key,
          text: info.caption,
          caption: c.caption,
          follow: null,
          matrix: c.matrix,
        }
      : null;
  }
  const q = scene.quads.find((x) => x.key === hot.key);
  if (!q?.picture) return null;
  return {
    id: hot.key,
    text: info.caption,
    caption: q.picture.caption,
    follow: q.key,
    matrix: q.matrix,
  };
}

type CapState = {
  items: [Cap | null, Cap | null];
  on: 0 | 1 | null;
  id: string | null;
};

export function RoomGl({
  stage,
  captionRoom,
  albums,
  reducedMotion,
  inert,
  onShown,
  onReady,
  onUnavailable,
  onPressRoom,
  onOpen,
  onOpenCrate,
  onHoldChange,
}: {
  // The board stage, whose rig the canvas follows.
  stage: RefObject<HTMLElement | null>;
  // The .rs-room of the caption stage's rig, where the captions go.
  captionRoom: HTMLElement | null;
  albums: Album[] | null;
  reducedMotion: boolean;
  inert: boolean;
  // The canvas has drawn its first frame with the walls, floor and wood in.
  onShown: () => void;
  // The canvas has drawn a frame with every texture and picture in.
  onReady: () => void;
  // WebGL could not be created, or its context was lost for good.
  onUnavailable: () => void;
  // A primary-button press on the room that hits no target.
  onPressRoom: (e: PointerEvent<HTMLDivElement>) => void;
  onOpen: (piece: FocusPiece) => void;
  onOpenCrate: () => void;
  // Whether a target is under the pointer (the tour holds while exploring).
  onHoldChange: (hold: boolean) => void;
}) {
  const handle = useRef<RoomCanvasHandle>(null);
  const scene = useMemo(() => buildScene({ albums }), [albums]);
  const groupRef = useRef<HTMLDivElement>(null);

  // Scripts and checks read the canvas's camera and scene through this.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as Record<string, unknown>;
    w.__roomGl = { handle };
    w.__roomGlStats = () => handle.current?.stats();
    return () => {
      delete w.__roomGl;
      delete w.__roomGlStats;
    };
  }, []);

  // --- Hover: the target under the last mouse position, picked once per
  // animation frame and again after every drawn frame (the camera may have
  // moved under a resting pointer).
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const pickFrame = useRef(0);
  const [hot, setHot] = useState<Hot | null>(null);
  const hotRef = useRef<Hot | null>(null);
  const holdRef = useRef(false);
  const onHold = useRef(onHoldChange);
  useEffect(() => {
    onHold.current = onHoldChange;
  }, [onHoldChange]);

  // The proxy with visible keyboard focus: its target shows its caption and
  // focus ring, and the tour holds while exploring.
  const [focusHot, setFocusHot] = useState<Hot | null>(null);
  const focusRef = useRef<Hot | null>(null);
  // The focused proxy and the quad whose screen box it takes.
  const focusEl = useRef<{ quad: string; el: HTMLButtonElement } | null>(null);
  const updateHold = useCallback(() => {
    const hold = hotRef.current !== null || focusRef.current !== null;
    if (hold !== holdRef.current) {
      holdRef.current = hold;
      onHold.current(hold);
    }
  }, []);

  const targetAt = useCallback((x: number, y: number): Hot | null => {
    const h = handle.current;
    const cam = h?.camera();
    if (!h || !cam) return null;
    const lifted = hotRef.current && hotRef.current.target.kind !== 'crate' ? hotRef.current.key : null;
    const hit = hitTest(h.scene().quads, cam, x, y, lifted);
    if (!hit || hit.quad.pick === 'solid' || hit.quad.pick === 'none') return null;
    return hotFromKey(hit.quad.key, hit.quad.pick);
  }, []);

  const repick = useCallback(() => {
    const p = pointer.current;
    const next = p ? targetAt(p.x, p.y) : null;
    if ((next?.key ?? null) !== (hotRef.current?.key ?? null)) {
      hotRef.current = next;
      setHot(next);
      const g = groupRef.current;
      if (g) g.style.cursor = !next ? '' : next.target.kind === 'crate' ? 'pointer' : 'zoom-in';
    }
    updateHold();
  }, [targetAt, updateHold]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (pickFrame.current) return;
    pickFrame.current = requestAnimationFrame(() => {
      pickFrame.current = 0;
      repick();
    });
  };
  const onPointerLeave = () => {
    pointer.current = null;
    repick();
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(pickFrame.current);
    },
    []
  );
  // A dialog opening over the room (inert) ends the hover.
  useEffect(() => {
    if (!inert) return;
    pointer.current = null;
    repick();
  }, [inert, repick]);

  // --- Captions: two elements, so the one going out fades while the new one
  // fades in. Each is placed with its quad's current world matrix.
  const shown = hot ?? focusHot;
  const wanted = useMemo(() => (shown ? captionFor(shown, scene, albums) : null), [shown, scene, albums]);
  const [caps, setCaps] = useState<CapState>({
    items: [null, null],
    on: null,
    id: null,
  });
  if ((wanted?.id ?? null) !== caps.id || (wanted && caps.on !== null && caps.items[caps.on]?.text !== wanted.text)) {
    const items: [Cap | null, Cap | null] = [caps.items[0], caps.items[1]];
    let on: 0 | 1 | null = null;
    if (wanted) {
      on = caps.items[0]?.id === wanted.id ? 0 : caps.items[1]?.id === wanted.id ? 1 : caps.on === 0 ? 1 : 0;
      items[on] = wanted;
    }
    setCaps({ items, on, id: wanted?.id ?? null });
  }
  const capEls = useRef<(HTMLDivElement | null)[]>([null, null]);
  const capsRef = useRef(caps);
  const placeCaptions = useCallback(() => {
    const h = handle.current;
    capsRef.current.items.forEach((c, i) => {
      const el = capEls.current[i];
      if (!el || !c) return;
      const m = (c.follow && h?.quadMatrix(c.follow)) || c.matrix;
      el.style.transform = captionTransform(m, c.caption);
    });
  }, []);
  useLayoutEffect(() => {
    capsRef.current = caps;
    placeCaptions();
  }, [caps, placeCaptions]);

  // --- Keyboard proxies: one button per target in the tab order (an album
  // slot without an album has none). A focused proxy takes its target's
  // screen box, so magnifiers and focus-following tools land on it, cut to
  // the root's box: a focused element that runs past the window edge would
  // make the browser scroll the root.
  const quadOf = useMemo(() => targetQuads(scene), [scene]);
  const proxies = useMemo(
    () =>
      scene.tabOrder.flatMap((t) => {
        const info = describeTarget(t, albums);
        const quad = quadOf.get(targetId(t));
        return info && quad ? [{ id: targetId(t), target: t, label: info.label, quad }] : [];
      }),
    [scene, albums, quadOf]
  );
  const proxyEls = useRef(new Map<string, HTMLButtonElement>());
  // Target id focused by a pointer click: that focus shows no ring, also when
  // a dialog hands focus back to it, until the keyboard moves focus on (Tab).
  const quiet = useRef<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') quiet.current = null;
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
  const placeProxy = useCallback(() => {
    const f = focusEl.current;
    const h = handle.current;
    const cam = h?.camera();
    const q = f && h?.scene().quads.find((x) => x.key === f.quad);
    if (!f || !cam || !q) return;
    const m = h?.quadMatrix(q.key) ?? q.matrix;
    const b = clampBox(projectedBox(cam, m, q.w, q.h), cam.root.width, cam.root.height);
    Object.assign(f.el.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  }, []);
  const onProxyFocus = (el: HTMLButtonElement, target: Target, quad: string) => {
    const id = targetId(target);
    let visible = false;
    try {
      visible = el.matches(':focus-visible');
    } catch {
      visible = false;
    }
    focusEl.current = { quad, el };
    placeProxy();
    if (quiet.current !== id) quiet.current = null;
    const next: Hot | null = visible && quiet.current !== id ? { key: target.kind === 'crate' ? `crate:${Math.max(0, crateIndex(quad))}` : quad, target } : null;
    focusRef.current = next;
    setFocusHot(next);
    updateHold();
  };
  const onProxyBlur = () => {
    focusEl.current = null;
    focusRef.current = null;
    setFocusHot(null);
    updateHold();
  };

  const onFrame = useCallback(() => {
    if (pointer.current) repick();
    placeCaptions();
    placeProxy();
  }, [repick, placeCaptions, placeProxy]);

  // --- Opening.
  const activate = (target: Target) => {
    const info = describeTarget(target, albums);
    if (!info) return;
    if (info.kind === 'crate') onOpenCrate();
    else onOpen(info.piece);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (targetAt(e.clientX, e.clientY)) return;
    onPressRoom(e);
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    // A proxy's own click (Enter, Space) opens its target itself.
    if (e.button !== 0 || (e.target as Element).closest('.rs-proxies')) return;
    const t = targetAt(e.clientX, e.clientY);
    if (!t) return;
    // Focus its proxy first, without a ring, so a dialog hands focus back to it.
    const id = targetId(t.target);
    quiet.current = id;
    proxyEls.current.get(id)?.focus({ preventScroll: true });
    activate(t.target);
  };

  return (
    <>
      <div
        ref={groupRef}
        className="rs-stage-room"
        role="group"
        aria-label={ROOM_LABEL}
        inert={inert ? true : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <RoomCanvas
          ref={handle}
          className="rs-gl"
          stage={stage}
          scene={scene}
          hoveredKey={hot && hot.target.kind !== 'crate' ? hot.key : null}
          ringKey={focusHot ? (quadOf.get(targetId(focusHot.target))?.key ?? null) : null}
          reducedMotion={reducedMotion}
          onShown={onShown}
          onReady={onReady}
          onUnavailable={onUnavailable}
          onFrame={onFrame}
        />
        <ul className="rs-proxies">
          {proxies.map((p) => (
            <li key={p.id}>
              <button
                ref={(el) => {
                  if (el) proxyEls.current.set(p.id, el);
                  else proxyEls.current.delete(p.id);
                }}
                type="button"
                className="rs-proxy"
                aria-label={p.label}
                aria-haspopup={p.target.kind === 'crate' ? 'dialog' : undefined}
                onFocus={(e) => onProxyFocus(e.currentTarget, p.target, p.quad.key)}
                onBlur={onProxyBlur}
                onClick={() => activate(p.target)}
              />
            </li>
          ))}
        </ul>
      </div>
      {captionRoom &&
        createPortal(
          caps.items.map((c, i) => (
            <div
              key={i}
              ref={(el) => {
                capEls.current[i] = el;
              }}
              className={`gp-cap${caps.on === i ? ' is-on' : ''}`}
              style={c && c.caption.size !== 22 ? { fontSize: c.caption.size } : undefined}
            >
              {c?.text}
            </div>
          )),
          captionRoom
        )}
    </>
  );
}
