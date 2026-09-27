"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { interpolatePosition, kNearestNeighbors } from "../state/projection";
import { useMapStore } from "../state/store";
import { albumAt, screenToWorld } from "./CursorTracker";

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
  /**
   * Flat [x0,y0,x1,y1,...] interpolated positions, owned by AlbumField. The
   * same array CursorTracker hover-tests against, so a click lands on
   * exactly the album the hover ring and pointer cursor were showing.
   */
  positionsRef: React.MutableRefObject<Float32Array>;
  /** CursorTracker's hover index (-1 = none), so a click keeps the album
   * the hover ring and label were showing when the button went down. */
  hoverRef: React.MutableRefObject<number>;
}

/** True when a text-entry element has keyboard focus (Escape belongs to it). */
function isTextInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return !["range", "checkbox", "radio", "button", "submit", "reset"].includes(type);
}

export function FocusController({ onFocusChange, positionsRef, hoverRef }: FocusControllerProps) {
  const { camera, gl } = useThree();
  const data = useMapStore((s) => s.data);
  const sliderT = useMapStore((s) => s.sliderT);
  const focus = useMapStore((s) => s.focus);

  // Escape releases focus (spec 4.4.9), unless a text field owns the key
  // (the search input uses Escape to close itself).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (useMapStore.getState().focusedId == null) return;
      if (isTextInputFocused()) return;
      focus(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focus]);
  const focusedId = useMapStore((s) => s.focusedId);

  useEffect(() => {
    if (!data) return;
    const canvas = gl.domElement;

    // Same hit test as hover (CursorTracker albumAt): draw order first, then
    // the nearest centre within at least 14 CSS px for a mouse, 24 for a
    // fingertip, or the whole drawn cover once it is bigger than that.
    function hitTestAndFocus(
      clientX: number,
      clientY: number,
      pointerType: string,
      hoverIndex: number,
    ) {
      if (!data) return;
      const rect = canvas.getBoundingClientRect();
      const cam = camera as THREE.OrthographicCamera;
      const [worldX, worldY] = screenToWorld(clientX, clientY, rect, cam);
      const idx = albumAt(
        worldX,
        worldY,
        cam,
        rect.height,
        gl.getPixelRatio(),
        pointerType,
        positionsRef.current,
        hoverIndex,
      );
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
    let tapStart: {
      pointerId: number;
      x: number;
      y: number;
      t: number;
      hoverIndex: number;
    } | null = null;
    let cancelled = false;

    function onPointerDown(e: PointerEvent) {
      activeCount++;
      if (activeCount === 1) {
        // Captured now: CursorTracker drops hover on press (until the
        // pointer moves), so by pointerup hoverRef no longer holds it.
        tapStart = {
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          t: performance.now(),
          hoverIndex: hoverRef.current,
        };
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
        if (elapsed < TAP_MAX_MS) {
          hitTestAndFocus(e.clientX, e.clientY, e.pointerType, tapStart.hoverIndex);
        }
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
  }, [data, camera, gl, focus, positionsRef, hoverRef]);

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
