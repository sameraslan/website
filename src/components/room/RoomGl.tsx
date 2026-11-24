'use client';

// The room as one WebGL canvas (gl/RoomCanvas), inside the room group that
// covers the .rs-root box, and what makes it interactive: pointer hover
// (picked in JS against the scene), the DOM captions in their own stage layer,
// and clicks that open a picture or the crate. The canvas follows the camera
// rig of the board stage, so board, captions and room share one camera.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import type { Album } from '@/lib/room';
import { ROOM_LABEL } from './copy';
import type { FocusPiece } from './FocusView';
import { describeTarget } from './pieces';
import type { Mat4 } from './gl/mat4';
import { hitTest } from './gl/pick';
import { RoomCanvas, type RoomCanvasHandle } from './gl/RoomCanvas';
import { buildScene, type Caption, type Scene, type Target } from './gl/scene';
import { captionTransform, crateIndex } from './gl/targets';

// One camera rig: dolly > sway > cam > room. Every stage layer uses the same one.
export function Rig({ children }: { children?: ReactNode }) {
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
  albums,
  reducedMotion,
  inert,
  onReady,
  onPressRoom,
  onOpen,
  onOpenCrate,
  onHoldChange,
}: {
  // The board stage, whose rig the canvas follows.
  stage: RefObject<HTMLElement | null>;
  albums: Album[] | null;
  reducedMotion: boolean;
  inert: boolean;
  // The canvas has drawn its first complete frame.
  onReady: () => void;
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
  // WebGL could not be created, or its context was lost for good: the canvas
  // is hidden.
  const [glUnavailable, setGlUnavailable] = useState(false);

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
    const hold = next !== null;
    if (hold !== holdRef.current) {
      holdRef.current = hold;
      onHold.current(hold);
    }
  }, [targetAt]);

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
    [],
  );
  // A dialog opening over the room (inert) ends the hover.
  useEffect(() => {
    if (!inert) return;
    pointer.current = null;
    repick();
  }, [inert, repick]);

  // --- Captions: two elements, so the one going out fades while the new one
  // fades in. Each is placed with its quad's current world matrix.
  const wanted = useMemo(() => (hot ? captionFor(hot, scene, albums) : null), [hot, scene, albums]);
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

  const onFrame = useCallback(() => {
    if (pointer.current) repick();
    placeCaptions();
  }, [repick, placeCaptions]);

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
    if (e.button !== 0) return;
    const t = targetAt(e.clientX, e.clientY);
    if (t) activate(t.target);
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
        {!glUnavailable && (
          <RoomCanvas
            ref={handle}
            className="rs-gl"
            stage={stage}
            scene={scene}
            hoveredKey={hot && hot.target.kind !== 'crate' ? hot.key : null}
            ringKey={null}
            reducedMotion={reducedMotion}
            onReady={onReady}
            onUnavailable={() => setGlUnavailable(true)}
            onFrame={onFrame}
          />
        )}
      </div>
      {/* Captions: under the board layer, over the canvas. */}
      <div className="rs-stage gp-stage-cap" aria-hidden="true">
        <Rig>
          {caps.items.map((c, i) => (
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
          ))}
        </Rig>
      </div>
    </>
  );
}
