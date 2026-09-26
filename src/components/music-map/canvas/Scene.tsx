"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";

import { registerDebug } from "../state/debug";
import { useMapStore } from "../state/store";
import { AlbumField } from "./AlbumField";
import { AmbientDrift } from "./AmbientDrift";
import { useAtlasTextures } from "./AtlasManager";
import { CameraBounds } from "./CameraBounds";
import { CameraRig } from "./CameraRig";
import { CursorTracker } from "./CursorTracker";
import { FlyToFocus } from "./FlyToFocus";
import { FocusController } from "./FocusController";
import { ProjectionBridge } from "./ProjectionBridge";
// import { RegionLabels } from "./RegionLabels"; // unmounted; centroids inaccurate
// Region washes deleted (see docs/superpowers/specs/2026-09-26-website-improvement-design.md
// 4.5.7); the paper clear color matches the site so the map reads as part of the page.

// Test hook only: registers window.__mapDebug.getCameraState() so UI-check /
// Playwright harnesses can read the live camera without a full QA side
// channel. No-op in production (see state/debug.ts).
function DebugExpose() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  useEffect(
    () =>
      registerDebug({
        getCameraState: () => ({
          x: camera.position.x,
          y: camera.position.y,
          zoom: camera.zoom,
        }),
      }),
    [camera],
  );
  return null;
}

export function Scene() {
  const data = useMapStore((s) => s.data);
  if (!data) return null;
  return (
    <Canvas
      orthographic
      camera={{
        manual: true,
        zoom: 2.4,
        position: [0, 0, 5],
        near: 0.1,
        far: 100,
        left: -0.75,
        right: 0.75,
        top: 0.55,
        bottom: -0.55,
      }}
      gl={{ alpha: false, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
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
      <SceneInner />
    </Canvas>
  );
}

function SceneInner() {
  const data = useMapStore((s) => s.data)!;
  const [zoomT, setZoomT] = useState(0);
  const [cursorWorld, setCursorWorld] = useState<[number, number] | null>(null);
  const [focus, setFocus] = useState<{ index: number; neighbors: number[] }>({
    index: -1,
    neighbors: [],
  });
  // Map zoomT (normalized [0, 1]) back to an approximate camera.zoom so the
  // atlas loader's threshold reads identically to the live camera state.
  const camZoom = 0.5 + zoomT * 7.5;
  const textures = useAtlasTextures(data.atlasUrls, camZoom);

  const handleFocusChange = useCallback(
    (i: number, n: number[]) => setFocus({ index: i, neighbors: n }),
    [],
  );

  return (
    <>
      <DebugExpose />
      <CameraRig onZoomT={setZoomT} />
      <FlyToFocus />
      <ProjectionBridge />
      <CursorTracker onWorld={setCursorWorld} />
      <FocusController onFocusChange={handleFocusChange} />
      <AmbientDrift />
      {/* region washes removed; the paper clear color matches the site so the
          map blends into the page rather than sitting on a colored field */}
      {/* labels removed; centroid clustering inaccurate for now */}
      {/* {data.regions.length > 0 && <RegionLabels regions={data.regions} zoomT={zoomT} />} */}
      <AlbumField
        data={data}
        atlasTextures={textures}
        zoomT={zoomT}
        cursorWorld={cursorWorld}
        focusedIndex={focus.index}
        neighborIndices={focus.neighbors}
      />
      {/* Mounted last so its frame callback runs after drift/tour have moved
          the camera, reining the idle camera back into the album cloud. */}
      <CameraBounds />
    </>
  );
}
