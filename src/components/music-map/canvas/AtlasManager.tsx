"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

const loader = new TextureLoader();

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

export function useAtlasTextures(urls: string[], camZoom: number) {
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    urls.map(() => null),
  );
  const loadingRef = useRef<Set<number>>(new Set());

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
    });
    return () => {
      cancelled = true;
    };
  }, [urls]);

  // Load later atlases as zoom crosses a threshold. The threshold is permissive
  // (any zoom past the initial value) so covers from later sheets aren't stuck
  // as black holes the moment the user zooms in.
  useEffect(() => {
    if (camZoom < 1.05) return;
    for (let i = 1; i < urls.length; i++) {
      if (textures[i] || loadingRef.current.has(i)) continue;
      loadingRef.current.add(i);
      loader.loadAsync(urls[i]).then((tex) => {
        configureAtlasTexture(tex);
        setTextures((prev) => {
          const next = [...prev];
          next[i] = tex;
          return next;
        });
      });
    }
  }, [camZoom, urls, textures]);

  return textures;
}
