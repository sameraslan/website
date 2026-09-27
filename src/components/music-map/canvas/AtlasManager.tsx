"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { requestRender } from "../state/invalidate";
import type { MapData } from "../data/types";

// ImageBitmapLoader decodes off the main thread (a worker + createImageBitmap),
// avoiding the 50-150ms main-thread decode hitch TextureLoader causes per
// atlas (perf audit item 1e). imageOrientation "none" and premultiplyAlpha
// "none" keep the decode from applying any browser-default transforms our
// pipeline doesn't expect.
const loader = new THREE.ImageBitmapLoader();
loader.setOptions({ imageOrientation: "none", premultiplyAlpha: "none" });

// Atlas-0 loads only once the camera is actually zoomed past the point where
// covers are legible; at the overview zoom nothing benefits from ~9MB of
// atlas download + decode per sheet (perf audit item 1d treated the previous
// 1.05 gate as effectively "always on" since the initial zoom already clears
// it). Real camera.zoom, not the normalized zoomT used for shader uniforms.
// Raised to 3.0 (controller-inspection fix, task 8 round 1): the sprite-size
// power curve in shaders/album.ts now keeps the disc-to-cover crossfade from
// starting until zoom ~3.1, so this gate sits just below that, no atlas
// downloads at the initial framing (zoom 2.4).
const ATLAS_ZOOM_THRESHOLD = 3.0;

function configureAtlasTexture(bitmap: ImageBitmap): THREE.Texture {
  const tex = new THREE.Texture(bitmap as unknown as HTMLImageElement);
  // Pipeline atlases are laid out with row 0 at the top (PIL pixel space),
  // and atlasUV.v in metadata is computed as py/sheet_size. Disable the
  // default flipY so v=0 still maps to the top row of the image.
  tex.flipY = false;
  // Atlases are authored as sRGB images. Our shaders write sRGB-authored
  // values straight to the framebuffer (no linear<->sRGB roundtrip), so
  // sampling must also stay in sRGB space, NoColorSpace skips the
  // implicit sRGB->linear conversion three.js would otherwise apply.
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function loadAtlas(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (bitmap) => resolve(configureAtlasTexture(bitmap as unknown as ImageBitmap)),
      undefined,
      (err) => reject(err),
    );
  });
}

/**
 * Per-position atlas index, aligned with data.positions (not data.metadata,
 * which is not guaranteed to be in the same order). Computed once per data
 * load and reused by the visible-sprite count below.
 */
function buildAtlasIndexByPosition(data: MapData): Int16Array {
  const metaById = new Map(data.metadata.map((m) => [m.id, m.atlasIndex] as const));
  const out = new Int16Array(data.positions.length);
  for (let i = 0; i < data.positions.length; i++) {
    out[i] = metaById.get(data.positions[i].id) ?? -1;
  }
  return out;
}

/**
 * Cheap O(n) pass over the current interpolated positions, counting how many
 * project inside the camera's NDC frustum (i.e. currently on screen) per
 * atlas index. Used to decide which not-yet-loaded sheet to fetch next, so
 * covers the user can actually see arrive before covers that are off-screen
 * (spec 4.5.3).
 */
function countVisibleSpritesByAtlas(
  atlasIndexByPosition: Int16Array,
  positionsRef: React.MutableRefObject<Float32Array>,
  camera: THREE.OrthographicCamera,
  atlasCount: number,
): number[] {
  const counts = new Array(atlasCount).fill(0);
  const positions = positionsRef.current;
  const n = atlasIndexByPosition.length;
  if (positions.length < n * 2) return counts;
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const atlasIndex = atlasIndexByPosition[i];
    if (atlasIndex < 0 || atlasIndex >= atlasCount) continue;
    v.set(positions[i * 2], positions[i * 2 + 1], 0);
    v.project(camera);
    if (v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1) {
      counts[atlasIndex]++;
    }
  }
  return counts;
}

/**
 * Loads atlas-0 once the camera crosses ATLAS_ZOOM_THRESHOLD, then the
 * remaining sheets one at a time, always picking whichever not-yet-loaded
 * sheet currently covers the most on-screen sprites (recomputed each time a
 * sheet finishes, since the camera may have moved during the load). Reads
 * camera.zoom directly off the live THREE camera inside useFrame (no React
 * state or prop feeds the zoom in), and only ever flips the `textures` state
 * array when a texture actually finishes loading or the threshold is crossed
 * for the first time, not once per frame.
 */
export function useAtlasTextures(
  data: MapData,
  positionsRef: React.MutableRefObject<Float32Array>,
): (THREE.Texture | null)[] {
  const urls = data.atlasUrls;
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    urls.map(() => null),
  );
  const atlasIndexByPosition = useMemo(() => buildAtlasIndexByPosition(data), [data]);
  const loadedRef = useRef<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const startedRef = useRef(false);

  // Reset per data load (a fresh MapData means fresh, empty atlas state).
  useEffect(() => {
    loadedRef.current = new Set();
    loadingRef.current = false;
    startedRef.current = false;
    setTextures(urls.map(() => null));
  }, [urls]);

  useFrame(() => {
    if (startedRef.current) return;
    if (camera.zoom < ATLAS_ZOOM_THRESHOLD) return;
    startedRef.current = true;
    loadNext();
  });

  function loadNext() {
    if (loadingRef.current) return;
    const remaining: number[] = [];
    for (let i = 0; i < urls.length; i++) {
      if (!loadedRef.current.has(i)) remaining.push(i);
    }
    if (remaining.length === 0) return;

    // Atlas-0 always goes first (it is the default/most common sheet and
    // there is no "visible count" yet on the very first load). After that,
    // load whichever remaining sheet currently covers the most on-screen
    // sprites.
    let nextIndex = remaining[0];
    if (loadedRef.current.size > 0 || !remaining.includes(0)) {
      const counts = countVisibleSpritesByAtlas(
        atlasIndexByPosition,
        positionsRef,
        camera,
        urls.length,
      );
      nextIndex = remaining.reduce(
        (best, i) => (counts[i] > counts[best] ? i : best),
        remaining[0],
      );
    }

    loadingRef.current = true;
    loadAtlas(urls[nextIndex])
      .then((tex) => {
        loadedRef.current.add(nextIndex);
        setTextures((prev) => {
          const next = [...prev];
          next[nextIndex] = tex;
          return next;
        });
        requestRender();
      })
      .catch((err) => {
        console.error("atlas load failed", urls[nextIndex], err);
        // Mark it loaded anyway so a single bad sheet doesn't wedge the
        // queue; the corresponding sprites just stay unloaded (u_atlasLoaded
        // stays 0 for that index).
        loadedRef.current.add(nextIndex);
      })
      .finally(() => {
        loadingRef.current = false;
        loadNext();
      });
  }

  return textures;
}
