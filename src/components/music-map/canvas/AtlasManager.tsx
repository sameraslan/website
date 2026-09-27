"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TextureLoader } from "three";

import { requestRender } from "../state/invalidate";

const loader = new TextureLoader();

// Permissive: any zoom past the initial value, so covers from later sheets
// aren't stuck as black holes the moment the user zooms in.
const ATLAS_ZOOM_THRESHOLD = 1.05;

function configureAtlasTexture(tex: THREE.Texture) {
  // Pipeline atlases are laid out with row 0 at the top (PIL pixel space),
  // and atlasUV.v in metadata is computed as py/sheet_size. Disable the
  // default flipY so v=0 still maps to the top row of the image.
  tex.flipY = false;
  // Atlases are authored as sRGB images. Our shaders write sRGB-authored
  // values straight to the framebuffer (no linear<->sRGB roundtrip), so
  // sampling must also stay in sRGB space — NoColorSpace skips the
  // implicit sRGB->linear conversion three.js would otherwise apply.
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
}

/**
 * Loads atlas-0 eagerly, then loads the rest once the camera crosses
 * ATLAS_ZOOM_THRESHOLD. Reads camera.zoom directly off the live THREE camera
 * inside useFrame (no React state or prop feeds the zoom in), and only ever
 * flips the `textures` state array when a texture actually finishes loading
 * or the threshold is crossed for the first time — not once per frame.
 */
export function useAtlasTextures(urls: string[]) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    urls.map(() => null),
  );
  const loadingRef = useRef<Set<number>>(new Set());
  const pastThresholdRef = useRef(false);

  // Eager-load atlas-0
  useEffect(() => {
    if (!urls[0]) return;
    let cancelled = false;
    loader.loadAsync(urls[0]).then((tex) => {
      if (cancelled) return;
      configureAtlasTexture(tex);
      setTextures((prev) => {
        const next = [...prev];
        next[0] = tex;
        return next;
      });
      requestRender();
    });
    return () => {
      cancelled = true;
    };
  }, [urls]);

  // Load later atlases once zoom crosses the threshold. Guarded by
  // pastThresholdRef so this only fires once; useFrame only runs on rendered
  // frames (frameloop="demand"), which happen whenever the camera actually
  // moves (wheel/drag/fly-to all invalidate), so the check still runs
  // promptly without needing its own invalidate loop.
  useFrame(() => {
    if (pastThresholdRef.current) return;
    if (camera.zoom < ATLAS_ZOOM_THRESHOLD) return;
    pastThresholdRef.current = true;
    for (let i = 1; i < urls.length; i++) {
      if (loadingRef.current.has(i)) continue;
      loadingRef.current.add(i);
      loader.loadAsync(urls[i]).then((tex) => {
        configureAtlasTexture(tex);
        setTextures((prev) => {
          const next = [...prev];
          next[i] = tex;
          return next;
        });
        requestRender();
      });
    }
  });

  return textures;
}
