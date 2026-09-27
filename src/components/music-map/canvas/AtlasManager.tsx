"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { requestRender } from "../state/invalidate";
import { getOverviewFraming } from "../state/view";
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
// Expressed as a multiple of the fitted overview zoom (task 8 fix round 2),
// not a fixed absolute zoom (round 1's "3.0" assumed a fixed 2.4 overview
// zoom, which stopped matching once the real dataset's fit zoom turned out
// much smaller): at 1.9x fit the sprite is about 24.6px, where the shader's
// disc-to-cover crossfade starts (see SIZE_CURVE_POWER in shaders/album.ts),
// so no atlas request lands before the user has actually zoomed in.
const ATLAS_ZOOM_THRESHOLD_FIT_MULTIPLE = 1.9;

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

interface LoadedAtlas {
  texture: THREE.Texture;
  bitmap: ImageBitmap;
}

/** Disposes both the GPU-side texture and the decoded ImageBitmap backing
 * it. Three's Texture.dispose() only releases the GPU upload; the
 * ImageBitmap itself (a separate, often large, decoded-pixel resource held
 * by the browser) needs its own close() call or it leaks until GC. */
function disposeLoadedAtlas(loaded: LoadedAtlas): void {
  loaded.texture.dispose();
  loaded.bitmap.close();
}

function loadAtlas(url: string): Promise<LoadedAtlas> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (result) => {
        const bitmap = result as unknown as ImageBitmap;
        resolve({ texture: configureAtlasTexture(bitmap), bitmap });
      },
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
  // Every loaded texture + its backing ImageBitmap, kept only for cleanup
  // (the `textures` state array above is what shader consumers read).
  const loadedAtlasesRef = useRef<Map<number, LoadedAtlas>>(new Map());
  // Bumped whenever the url set changes or the component unmounts. loadNext
  // captures the epoch active when it starts a load; if the epoch has moved
  // on by the time that load resolves (unmount, or a new MapData swapped
  // in), the result is disposed instead of written into state, so neither
  // an unmounted component nor a stale data set ever leaks a texture/bitmap.
  const epochRef = useRef(0);

  // Reset per data load (a fresh MapData means fresh, empty atlas state),
  // and dispose whatever the previous url set had already loaded.
  useEffect(() => {
    epochRef.current += 1;
    loadedRef.current = new Set();
    loadingRef.current = false;
    startedRef.current = false;
    for (const loaded of loadedAtlasesRef.current.values()) {
      disposeLoadedAtlas(loaded);
    }
    loadedAtlasesRef.current = new Map();
    setTextures(urls.map(() => null));

    return () => {
      epochRef.current += 1;
      for (const loaded of loadedAtlasesRef.current.values()) {
        disposeLoadedAtlas(loaded);
      }
      loadedAtlasesRef.current = new Map();
    };
  }, [urls]);

  useFrame(() => {
    if (startedRef.current) return;
    const threshold = ATLAS_ZOOM_THRESHOLD_FIT_MULTIPLE * getOverviewFraming().zoom;
    if (camera.zoom < threshold) return;
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

    const myEpoch = epochRef.current;
    loadingRef.current = true;
    loadAtlas(urls[nextIndex])
      .then((loaded) => {
        if (epochRef.current !== myEpoch) {
          // The url set changed or the component unmounted while this atlas
          // was in flight: don't write into stale state, just release it.
          disposeLoadedAtlas(loaded);
          return;
        }
        loadedRef.current.add(nextIndex);
        loadedAtlasesRef.current.set(nextIndex, loaded);
        setTextures((prev) => {
          const next = [...prev];
          next[nextIndex] = loaded.texture;
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
        if (epochRef.current === myEpoch) loadNext();
      });
  }

  return textures;
}
