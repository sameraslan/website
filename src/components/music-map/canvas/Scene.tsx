"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { interpolatedPositions } from "../state/bounds";
import { bumpCommitCounter, registerDebug } from "../state/debug";
import { setInvalidate } from "../state/invalidate";
import { interpolatePosition } from "../state/projection";
import { useMapStore } from "../state/store";
import { getOverviewFraming } from "../state/view";
import { AlbumField } from "./AlbumField";
import { AmbientDrift } from "./AmbientDrift";
import { useAtlasTextures } from "./AtlasManager";
import { CameraBounds } from "./CameraBounds";
import { CameraRig } from "./CameraRig";
import { CursorTracker, screenToWorld } from "./CursorTracker";
import { FlyToFocus } from "./FlyToFocus";
import { FocusController } from "./FocusController";
import { FRUSTUM_HALF_HEIGHT, InitialFrame } from "./InitialFrame";
import { RegionLabels } from "./RegionLabels";
import { TooltipDriver } from "./TooltipDriver";
// Region washes deleted (see docs/superpowers/specs/2026-09-26-website-improvement-design.md
// 4.5.7); the paper clear color matches the site so the map reads as part of the page.

// Test hook only: registers window.__mapDebug.getCameraState() so UI-check /
// Playwright harnesses can read the live camera without a full QA side
// channel. No-op in production (see state/debug.ts).
function DebugExpose() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  useEffect(
    () =>
      registerDebug({
        getCameraState: () => ({
          x: camera.position.x,
          y: camera.position.y,
          zoom: camera.zoom,
        }),
        getRendererInfo: () => ({
          textures: gl.info.memory.textures,
          geometries: gl.info.memory.geometries,
        }),
        getSliderT: () => useMapStore.getState().sliderT,
        getFocusedAlbumPos: () => {
          const s = useMapStore.getState();
          if (!s.focusedId || !s.data) return null;
          const p = s.data.positions.find((q) => q.id === s.focusedId);
          if (!p) return null;
          const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, s.sliderT);
          return { x, y };
        },
        // Test-only: projects a real album's current world position to
        // screen (viewport) coordinates, so Playwright can dispatch a
        // pointermove at a coordinate guaranteed to land on an album dot
        // rather than guessing at empty space. Picks the middle index of
        // the position list, not necessarily the visually densest point,
        // but always a real album.
        getNearestScreenPoint: () => {
          const s = useMapStore.getState();
          if (!s.data || s.data.positions.length === 0) return null;
          const p = s.data.positions[Math.floor(s.data.positions.length / 2)];
          const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, s.sliderT);
          const v = new THREE.Vector3(x, y, 0);
          v.project(camera);
          const canvas = document.querySelector("canvas");
          if (!canvas) return null;
          const rect = canvas.getBoundingClientRect();
          return {
            x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
            y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
          };
        },
        getWorldAt: (clientX, clientY) => {
          const canvas = document.querySelector("canvas");
          if (!canvas) return null;
          const rect = canvas.getBoundingClientRect();
          const [x, y] = screenToWorld(clientX, clientY, rect, camera);
          return { x, y };
        },
        getFitState: () => {
          const f = getOverviewFraming();
          return { center: { ...f.center }, fitZoom: f.zoom, bounds: { ...f.bounds } };
        },
        getNdcInsideFraction: () => {
          const s = useMapStore.getState();
          if (!s.data || s.data.positions.length === 0) return null;
          const xy = interpolatedPositions(s.data, s.sliderT);
          const v = new THREE.Vector3();
          const n = xy.length / 2;
          let inside = 0;
          for (let i = 0; i < n; i++) {
            v.set(xy[i * 2], xy[i * 2 + 1], 0).project(camera);
            if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) inside++;
          }
          return inside / n;
        },
      }),
    [camera, gl],
  );
  return null;
}

// Bridges R3F's demand-mode invalidate() out to state/invalidate.ts, so DOM
// overlays outside the <Canvas> (the Slider, and the Zustand store's
// setSliderT) can request a render without importing @react-three/fiber.
function InvalidateBridge() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setInvalidate(invalidate);
    return () => setInvalidate(null);
  }, [invalidate]);
  return null;
}

export function Scene({ isTouch = false }: { isTouch?: boolean }) {
  const data = useMapStore((s) => s.data);
  if (!data) return null;
  return (
    <Canvas
      orthographic
      frameloop="demand"
      camera={{
        manual: true,
        zoom: 2.4,
        position: [0, 0, 5],
        near: 0.1,
        far: 100,
        // Placeholder frustum: InitialFrame sets left/right to
        // ±FRUSTUM_HALF_HEIGHT * aspect on mount and on every resize, in a
        // layout effect before the first frame is drawn.
        left: -FRUSTUM_HALF_HEIGHT,
        right: FRUSTUM_HALF_HEIGHT,
        top: FRUSTUM_HALF_HEIGHT,
        bottom: -FRUSTUM_HALF_HEIGHT,
      }}
      gl={{ alpha: false, antialias: false }}
      // Touch devices cap dpr at 1.5 (not 2): phones already push more
      // pixels per point than desktop, and the pinch/pan gesture path draws
      // every frame, so keeping fill-rate down matters more than it does on
      // a mouse-driven desktop where dpr=2 is cheap by comparison (spec 4.7).
      dpr={[1, isTouch ? 1.5 : 2]}
      // Touch-action: none so the browser never hijacks a one- or two-finger
      // gesture on the canvas for native scroll/zoom; CameraRig owns pan and
      // pinch entirely via pointer events (Task 11 item 2).
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
      onCreated={({ gl }) => {
        // Our ShaderMaterials write sRGB-authored colors straight to the
        // framebuffer (Three.js does not auto-inject the linear->sRGB
        // conversion for custom ShaderMaterials). LinearSRGBColorSpace
        // tells Three.js not to apply any conversion either, so the
        // literal hex values land in the framebuffer unchanged.
        gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        // Set clear color via a raw RGB triple so Three.js does not
        // sRGB-decode it. The shaders write paper directly, so any pixel
        // not covered by a draw still reads as cream rather than black.
        const paper = new THREE.Color();
        paper.setRGB(0.980, 0.965, 0.926, THREE.LinearSRGBColorSpace);
        gl.setClearColor(paper, 1);
      }}
    >
      <SceneInner isTouch={isTouch} />
    </Canvas>
  );
}

function SceneInner({ isTouch }: { isTouch: boolean }) {
  const data = useMapStore((s) => s.data)!;
  const invalidate = useThree((s) => s.invalidate);
  // Hot-path camera/cursor state lives in refs, not React state: pointermove
  // and zoom frames must never trigger a SceneInner re-render (see
  // docs/superpowers/notes/2026-09-26-music-map-perf-audit.md items 2a/2b).
  // CameraRig writes zoomRef.current every frame from the real camera.zoom;
  // CursorTracker writes cursorRef.current on pointermove. AlbumField reads
  // both in its own useFrame to set uniforms.
  const zoomRef = useRef(2.4);
  const cursorRef = useRef<[number, number] | null>(null);
  // Hover target index (-1 = none), written by CursorTracker on pointermove,
  // read by AlbumField (uniform + ring) and TooltipDriver (tooltip target).
  // A ref, not React state: hover changes on every pointermove and must
  // never trigger a SceneInner re-render.
  const hoverRef = useRef(-1);
  // Flat [x0,y0,x1,y1,...] interpolated positions, owned and recomputed by
  // AlbumField whenever sliderT changes; read by CursorTracker (hit-testing)
  // and TooltipDriver (tooltip placement).
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  // Flat [x0,y0,...] per-cluster median positions at the current sliderT,
  // indexed by clusterId; owned and recomputed by AlbumField whenever
  // positionsRef is rebuilt, read every frame by the RegionLabels driver.
  const centroidsRef = useRef<Float32Array>(new Float32Array(0));
  // Member count per clusterId, fixed per data load; owned by AlbumField,
  // read by the RegionLabels driver to hide labels for tiny clusters.
  const clusterCountsRef = useRef<Uint32Array>(new Uint32Array(0));
  const [focus, setFocus] = useState<{ index: number; neighbors: number[] }>({
    index: -1,
    neighbors: [],
  });
  const textures = useAtlasTextures(data, positionsRef);

  // id -> index into positionsRef, built once per data load (positions are
  // append-only per session; order matches data.positions throughout).
  const idIndexById = useMemo(() => {
    const m = new Map<string, number>();
    data.positions.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [data]);

  const handleFocusChange = useCallback(
    (i: number, n: number[]) => {
      setFocus({ index: i, neighbors: n });
      // Focus changes are rare (click/escape), but under frameloop="demand"
      // the resulting prop change into AlbumField's useFrame closure still
      // needs an explicit render to actually draw.
      invalidate();
    },
    [invalidate],
  );

  // Dev-only: counts SceneInner commits so ui-check's profile-moves.mjs can
  // assert pointermove causes zero React re-renders inside the canvas tree.
  useEffect(() => {
    bumpCommitCounter();
  });

  return (
    <>
      <DebugExpose />
      <InvalidateBridge />
      {/* Snaps the camera to the fitted overview once per data load and
          publishes the framing (state/view.ts) that CameraRig, AlbumField,
          RegionLabels, AtlasManager and CameraBounds read. */}
      <InitialFrame />
      <CameraRig zoomRef={zoomRef} />
      <FlyToFocus />
      <CursorTracker cursorRef={cursorRef} hoverRef={hoverRef} positionsRef={positionsRef} />
      <FocusController onFocusChange={handleFocusChange} positionsRef={positionsRef} />
      {/* Drift is a desktop-only idle flourish: touch has no notion of "the
          user hasn't touched anything for a while" the way a resting mouse
          does, and drifting the camera under a finger mid-gesture would be
          actively disorienting (spec 4.7). */}
      {!isTouch && <AmbientDrift />}
      {/* region washes removed; the paper clear color matches the site so the
          map blends into the page rather than sitting on a colored field */}
      <AlbumField
        data={data}
        atlasTextures={textures}
        zoomRef={zoomRef}
        cursorRef={cursorRef}
        hoverRef={hoverRef}
        positionsRef={positionsRef}
        centroidsRef={centroidsRef}
        clusterCountsRef={clusterCountsRef}
        focusedIndex={focus.index}
        neighborIndices={focus.neighbors}
      />
      <TooltipDriver positionsRef={positionsRef} idIndexById={idIndexById} />
      {data.regions.length > 0 && (
        <RegionLabels
          regions={data.regions}
          centroidsRef={centroidsRef}
          clusterCountsRef={clusterCountsRef}
          zoomRef={zoomRef}
        />
      )}
      {/* Mounted last so its frame callback runs after drift/tour have moved
          the camera, reining the idle camera back into the album cloud. */}
      <CameraBounds />
    </>
  );
}
