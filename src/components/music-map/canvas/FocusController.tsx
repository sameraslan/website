"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";
import {
  interpolatePosition,
  kNearestNeighbors,
  nearestAlbumIndex,
} from "../state/projection";

const HIT_RADIUS = 0.04;
const NEIGHBOR_K = 10;

interface FocusControllerProps {
  /** Receives the resolved focused-index and neighbor indices each render. */
  onFocusChange: (focusedIndex: number, neighborIndices: number[]) => void;
}

export function FocusController({ onFocusChange }: FocusControllerProps) {
  const { camera, gl } = useThree();
  const data = useMapStore((s) => s.data);
  const sliderT = useMapStore((s) => s.sliderT);
  const focus = useMapStore((s) => s.focus);
  const focusedId = useMapStore((s) => s.focusedId);

  useEffect(() => {
    if (!data) return;
    const canvas = gl.domElement;

    function onClick(e: MouseEvent) {
      if (!data) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const cam = camera as THREE.OrthographicCamera;
      const worldX = (ndcX / cam.zoom) * (cam.right - cam.left) / 2 + cam.position.x;
      const worldY = (ndcY / cam.zoom) * (cam.top - cam.bottom) / 2 + cam.position.y;
      const idx = nearestAlbumIndex(data.positions, worldX, worldY, sliderT, HIT_RADIUS);
      if (idx < 0) {
        focus(null);
      } else {
        focus(data.positions[idx].id);
      }
    }

    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [data, camera, gl, sliderT, focus]);

  // Recompute the neighbor index list whenever focus or slider changes
  useEffect(() => {
    if (!data) {
      onFocusChange(-1, []);
      return;
    }
    if (!focusedId) {
      onFocusChange(-1, []);
      return;
    }
    const idxById = new Map<string, number>();
    data.positions.forEach((p, i) => idxById.set(p.id, i));
    const focusedIndex = idxById.get(focusedId) ?? -1;
    if (focusedIndex < 0) {
      onFocusChange(-1, []);
      return;
    }
    const positionsMap = new Map<string, [number, number]>();
    for (const p of data.positions) {
      positionsMap.set(p.id, interpolatePosition(p.audio, p.balanced, p.mood, sliderT));
    }
    const neighborIds = kNearestNeighbors(focusedId, positionsMap, NEIGHBOR_K);
    const neighborIndices = neighborIds
      .map((id) => idxById.get(id) ?? -1)
      .filter((i) => i >= 0);
    onFocusChange(focusedIndex, neighborIndices);
  }, [data, focusedId, sliderT, onFocusChange]);

  return null;
}
