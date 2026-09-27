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
/** A gesture counts as a tap (not a drag/pinch) below this squared movement
 * (in CSS px, so 8px matches spec 4.7's "< 8px movement"). */
const TAP_MOVE_SQ = 8 * 8;
/** A gesture counts as a tap only if pointerdown-to-pointerup takes less
 * than this (spec 4.7's "< 300ms"). */
const TAP_MAX_MS = 300;

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

    function hitTestAndFocus(clientX: number, clientY: number) {
      if (!data) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
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

    // Tap-to-focus, unified for mouse and touch (spec 4.7 / Task 11 item 3):
    // a "tap" is a short pointerdown-to-pointerup on the same pointer, with
    // < 8px of movement and < 300ms elapsed. Tracked independently of
    // CameraRig's own pointer bookkeeping (both simply listen on the same
    // canvas). A second pointer joining mid-gesture (a pinch) cancels the
    // tap outright, so a two-finger zoom can never also toggle focus.
    let activeCount = 0;
    let tapStart: { pointerId: number; x: number; y: number; t: number } | null = null;
    let cancelled = false;

    function onPointerDown(e: PointerEvent) {
      activeCount++;
      if (activeCount === 1) {
        tapStart = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
        cancelled = false;
      } else {
        // A second pointer means this whole gesture is a pinch, not a tap.
        cancelled = true;
        tapStart = null;
      }
    }
    function onPointerMove(e: PointerEvent) {
      if (!tapStart || e.pointerId !== tapStart.pointerId) return;
      const dx = e.clientX - tapStart.x;
      const dy = e.clientY - tapStart.y;
      if (dx * dx + dy * dy > TAP_MOVE_SQ) cancelled = true;
    }
    function onPointerUp(e: PointerEvent) {
      activeCount = Math.max(0, activeCount - 1);
      if (tapStart && e.pointerId === tapStart.pointerId && !cancelled) {
        const elapsed = performance.now() - tapStart.t;
        if (elapsed < TAP_MAX_MS) hitTestAndFocus(e.clientX, e.clientY);
      }
      if (activeCount === 0) tapStart = null;
    }
    function onPointerCancel() {
      activeCount = Math.max(0, activeCount - 1);
      tapStart = null;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    };
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
