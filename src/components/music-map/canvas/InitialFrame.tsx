"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";

import type { MapData } from "../data/types";
import { cloudCenter, fitZoom, getCloudBounds } from "../state/bounds";
import { useMapStore } from "../state/store";
import { setOverviewFraming } from "../state/view";

/**
 * Frames the overview camera on the album cloud and publishes the fitted
 * framing (state/view.ts).
 *
 * On every data load (once per MapData object) the camera snaps, instantly
 * and without animation, to the centre of the cloud's percentile bounds at
 * the zoom that fits those bounds to the frustum with margin. On a sliderT
 * change the framing is recomputed and republished for its consumers
 * (CameraRig, AlbumField, RegionLabels, AtlasManager, CameraBounds,
 * FlyToFocus) without moving the camera, so the slider never yanks the view.
 *
 * A layout effect, so the framing is published before R3F draws the first
 * frame: AlbumField's u_fitZoom and the labels' fade never see the
 * pre-load fallback.
 */
export function InitialFrame() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  const data = useMapStore((s) => s.data);
  const sliderT = useMapStore((s) => s.sliderT);
  const framedData = useRef<MapData | null>(null);

  useLayoutEffect(() => {
    if (!data || data.positions.length === 0) return;
    const bounds = getCloudBounds(data, sliderT);
    const center = cloudCenter(bounds);
    const zoom = fitZoom(bounds, {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    });
    setOverviewFraming({ zoom, center, bounds });

    if (framedData.current === data) return;
    framedData.current = data;
    camera.position.x = center.x;
    camera.position.y = center.y;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    invalidate();
  }, [data, sliderT, camera, invalidate]);

  return null;
}
