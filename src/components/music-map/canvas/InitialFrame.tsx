"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";

import type { MapData } from "../data/types";
import { cloudCenter, fitZoom, getCloudBounds } from "../state/bounds";
import { useMapStore } from "../state/store";
import { setFramed, setOverviewFraming } from "../state/view";

/**
 * Half the frustum height in world units. Fixed; the half-width follows the
 * canvas aspect (FRUSTUM_HALF_HEIGHT * width / height) so world units are
 * square on screen and a round cluster renders round.
 */
export const FRUSTUM_HALF_HEIGHT = 0.55;

/**
 * Owns the orthographic frustum and the overview framing.
 *
 * - Frustum: on mount and on every canvas resize, `left/right` are set to
 *   `±FRUSTUM_HALF_HEIGHT * aspect` (top/bottom stay `±FRUSTUM_HALF_HEIGHT`).
 *   The camera is `manual`, so R3F never touches these itself.
 * - Framing: computes the cloud's percentile bounds, their centre and the
 *   fitted zoom for the live frustum, and publishes them (state/view.ts) for
 *   CameraRig, AlbumField, RegionLabels, AtlasManager, CameraBounds and
 *   FlyToFocus. Recomputed on data, sliderT and size changes.
 * - Snap: once per MapData the camera jumps, without animation, to the
 *   framing centre and fitted zoom. A resize re-snaps only while the user
 *   has not yet grabbed the camera or focused an album; a slider change
 *   never moves the camera.
 *
 * A layout effect, so all of this lands before R3F draws the first frame.
 */
export function InitialFrame() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const data = useMapStore((s) => s.data);
  const sliderT = useMapStore((s) => s.sliderT);
  const framedData = useRef<MapData | null>(null);
  const lastSize = useRef<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (width > 0 && height > 0) {
      const halfW = FRUSTUM_HALF_HEIGHT * (width / height);
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = FRUSTUM_HALF_HEIGHT;
      camera.bottom = -FRUSTUM_HALF_HEIGHT;
      camera.updateProjectionMatrix();
    }
    const sizeChanged =
      lastSize.current !== null &&
      (lastSize.current.width !== width || lastSize.current.height !== height);
    lastSize.current = { width, height };

    if (!data || data.positions.length === 0) {
      framedData.current = null;
      setFramed(false);
      invalidate();
      return;
    }

    const bounds = getCloudBounds(data, sliderT);
    const center = cloudCenter(bounds);
    const zoom = fitZoom(bounds, {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    });
    setOverviewFraming({ zoom, center, bounds });

    const newData = framedData.current !== data;
    // New data invalidates the previous snap until the one below lands.
    if (newData) setFramed(false);
    const { lastCameraGrab, focusedId } = useMapStore.getState();
    const untouched = lastCameraGrab === 0 && focusedId === null;
    if (newData || (sizeChanged && untouched)) {
      framedData.current = data;
      camera.position.x = center.x;
      camera.position.y = center.y;
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      setFramed(true);
    }
    invalidate();
  }, [data, sliderT, width, height, camera, invalidate]);

  return null;
}
