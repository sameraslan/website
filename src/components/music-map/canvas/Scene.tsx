"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useState } from "react";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

import { useMapStore } from "../state/store";
import { AlbumField } from "./AlbumField";
import { AmbientDrift } from "./AmbientDrift";
import { useAtlasTextures } from "./AtlasManager";
import { BackgroundLayer } from "./BackgroundLayer";
import { CameraRig } from "./CameraRig";
import { CursorTracker } from "./CursorTracker";
import { FlyToFocus } from "./FlyToFocus";
import { FocusController } from "./FocusController";
import { ProjectionBridge } from "./ProjectionBridge";
// import { RegionLabels } from "./RegionLabels"; // unmounted; centroids inaccurate
import { RegionWashes } from "./RegionWashes";

// Expose the live r3f camera + scene on window for QA harnesses and devtools
// inspection. Pure read-only side channel; production cost is negligible.
function QAExpose() {
  const { camera, scene } = useThree();
  useEffect(() => {
    (window as unknown as { __mapThree?: unknown }).__mapThree = {
      get camera() {
        return camera;
      },
      get scene() {
        return scene;
      },
    };
    return () => {
      delete (window as unknown as { __mapThree?: unknown }).__mapThree;
    };
  }, [camera, scene]);
  return null;
}

export function Scene() {
  const data = useMapStore((s) => s.data);
  if (!data) return null;
  return (
    <Canvas
      orthographic
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
        paper.setRGB(0.965, 0.941, 0.882, THREE.LinearSRGBColorSpace);
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
      <OrthographicCamera
        makeDefault
        position={[0, 0, 5]}
        zoom={1}
        near={0.1}
        far={100}
        left={-0.75}
        right={0.75}
        top={0.55}
        bottom={-0.55}
      />
      <QAExpose />
      <CameraRig onZoomT={setZoomT} />
      <FlyToFocus />
      <ProjectionBridge />
      <CursorTracker onWorld={setCursorWorld} />
      <FocusController onFocusChange={handleFocusChange} />
      <AmbientDrift />
      <BackgroundLayer zoomT={zoomT} />
      {data.regions.length > 0 && <RegionWashes regions={data.regions} zoomT={zoomT} />}
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
    </>
  );
}
