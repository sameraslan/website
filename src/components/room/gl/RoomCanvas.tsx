'use client';

// The room's WebGL canvas and its frame loop. The camera stays in CSS: every
// animation frame this reads the computed transforms of a stage's rig
// (.rs-dolly, .rs-sway, .rs-cam), the root's --rs-scale and the root's rect,
// and draws a frame only when one of them changed, the scene, hover or ring
// changed, or the renderer asked for one (a texture arrived, an animation is
// running). Nothing runs while the document is hidden. three.js and the
// renderer load in their own chunk through a dynamic import(); if that chunk
// fails to load, the canvas reports itself unavailable.
// The canvas must cover the .rs-root box exactly (the camera maps the room
// onto that box).

import { useEffect, useImperativeHandle, useRef, type CSSProperties, type Ref, type RefObject } from 'react';
import { makeCamera, rigFromCss, type Camera } from './camera';
import type { Mat4 } from './mat4';
import type { Scene } from './scene';
import type { RoomRenderer } from './renderer';

export type RoomCanvasHandle = {
  // The camera of the last frame drawn (null before the first).
  camera(): Camera | null;
  // A quad's world matrix as last drawn, hover lift included.
  quadMatrix(key: string): Mat4 | null;
  // The scene being drawn.
  scene(): Scene;
  // Draw calls of the last frame and the textures held (for checks).
  stats(): { drawCalls: number; textures: number; textureBytes: number } | null;
};

export type RoomCanvasUnavailable = 'no-webgl' | 'context-lost';

export type RoomCanvasProps = {
  // The .rs-stage whose rig (.rs-dolly > .rs-sway > .rs-cam) the canvas follows.
  stage: RefObject<HTMLElement | null>;
  // The scene to draw (buildScene).
  scene: Scene;
  hoveredKey: string | null;
  ringKey: string | null;
  reducedMotion: boolean;
  // The first frame with the walls, floor and wood textures in has been
  // drawn (pictures may still be loading). Fires once.
  onShown?: () => void;
  // Every texture and picture is in and a full frame has been drawn (again
  // after each new album list).
  onReady?: () => void;
  // WebGL could not be created (or its code did not load), or the context was
  // lost and not restored within 3 s of the page being visible.
  onUnavailable?: (reason: RoomCanvasUnavailable) => void;
  // After each drawn frame, with that frame's camera (pointer hover re-picks
  // here while the camera moves under a resting pointer).
  onFrame?: (camera: Camera) => void;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<RoomCanvasHandle>;
};

const LOST_GRACE_MS = 3000;

// Whether the browser can create a WebGL 2 context, tried on a throwaway
// canvas, so a browser without one never loads three.js (whose own failure
// would also log an error).
function canCreateWebGl2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
const CANVAS_STYLE: CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'block' };

export function RoomCanvas({ stage, scene, hoveredKey, ringKey, reducedMotion, onShown, onReady, onUnavailable, onFrame, className, style, ref }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RoomRenderer | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const dirty = useRef(true);
  const sceneRef = useRef(scene);
  const callbacks = useRef({ onShown, onReady, onUnavailable, onFrame });
  useEffect(() => {
    callbacks.current = { onShown, onReady, onUnavailable, onFrame };
  }, [onShown, onReady, onUnavailable, onFrame]);
  const live = useRef({ hoveredKey, ringKey, reducedMotion });

  useImperativeHandle(
    ref,
    () => ({
      camera: () => cameraRef.current,
      quadMatrix: (key: string) => rendererRef.current?.quadMatrix(key) ?? null,
      scene: () => sceneRef.current,
      stats: () => rendererRef.current?.stats() ?? null,
    }),
    []
  );

  // Scene, hover, ring and motion preference go to the renderer when it exists
  // (and again when it is created, from `live`).
  useEffect(() => {
    sceneRef.current = scene;
    rendererRef.current?.setScene(scene);
    dirty.current = true;
  }, [scene]);
  useEffect(() => {
    live.current = { hoveredKey, ringKey, reducedMotion };
    const r = rendererRef.current;
    if (!r) return;
    r.setReducedMotion(reducedMotion);
    r.setHovered(hoveredKey);
    r.setRing(ringKey);
    dirty.current = true;
  }, [hoveredKey, ringKey, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let raf = 0;
    let lostTimer = 0;
    let lost = false;
    let lastKey = '';
    let lastSize = '';
    const offs: (() => void)[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const r = rendererRef.current;
      const st = stage.current;
      const root = st?.closest<HTMLElement>('.rs-root');
      if (!r || !st || !root) return;
      const dolly = st.querySelector('.rs-dolly');
      const sway = st.querySelector('.rs-sway');
      const cam = st.querySelector('.rs-cam');
      if (!dolly || !sway || !cam) return;
      const t = { dolly: getComputedStyle(dolly).transform, sway: getComputedStyle(sway).transform, cam: getComputedStyle(cam).transform };
      const scale = parseFloat(getComputedStyle(root).getPropertyValue('--rs-scale')) || 1;
      const rect = root.getBoundingClientRect();
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const size = `${cw}x${ch}@${window.devicePixelRatio}`;
      if (size !== lastSize) {
        lastSize = size;
        r.resize(cw, ch, window.devicePixelRatio);
        dirty.current = true;
      }
      const key = `${t.dolly}|${t.sway}|${t.cam}|${scale}|${rect.width}x${rect.height}`;
      if (key === lastKey && !dirty.current) return;
      lastKey = key;
      const camera = makeCamera(rigFromCss(t), scale, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      cameraRef.current = camera;
      dirty.current = r.render(camera, now);
      callbacks.current.onFrame?.(camera);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    // While the context is lost, the grace period runs only while the page is
    // visible (a hidden tab may lose its context and get it back on return).
    const armLostTimer = () => {
      window.clearTimeout(lostTimer);
      if (lost && !document.hidden) lostTimer = window.setTimeout(() => callbacks.current.onUnavailable?.('context-lost'), LOST_GRACE_MS);
    };
    const onVisibility = () => {
      armLostTimer();
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        dirty.current = true;
        start();
      }
    };

    if (!canCreateWebGl2()) {
      callbacks.current.onUnavailable?.('no-webgl');
      return;
    }

    import('./renderer').then(({ createRoomRenderer }) => {
      if (cancelled) return;
      let r: RoomRenderer;
      try {
        r = createRoomRenderer(canvas, { reducedMotion: live.current.reducedMotion });
      } catch {
        callbacks.current.onUnavailable?.('no-webgl');
        return;
      }
      rendererRef.current = r;
      offs.push(
        r.onInvalidate(() => {
          dirty.current = true;
        }),
        r.onShown(() => callbacks.current.onShown?.()),
        r.onReady(() => callbacks.current.onReady?.()),
        r.onContextLost(() => {
          lost = true;
          armLostTimer();
        }),
        r.onContextRestored(() => {
          lost = false;
          armLostTimer();
          dirty.current = true;
        })
      );
      r.setScene(sceneRef.current);
      r.setHovered(live.current.hoveredKey);
      r.setRing(live.current.ringKey);
      document.addEventListener('visibilitychange', onVisibility);
      start();
    }, () => {
      if (!cancelled) callbacks.current.onUnavailable?.('no-webgl');
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(lostTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      offs.forEach((off) => off());
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [stage]);

  return <canvas ref={canvasRef} className={className} style={{ ...CANVAS_STYLE, ...style }} aria-hidden="true" />;
}
