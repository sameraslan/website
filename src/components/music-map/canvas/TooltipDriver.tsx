"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useMapStore } from "../state/store";
import { getTooltipEl } from "../state/tooltipEl";

interface TooltipDriverProps {
  /** Flat [x0,y0,x1,y1,...] interpolated positions, maintained by AlbumField. */
  positionsRef: React.MutableRefObject<Float32Array>;
  /** id -> index into positionsRef, built once from data.positions. */
  idIndexById: Map<string, number>;
}

/**
 * Lives inside the canvas tree. Every rendered frame (fly-to, drift, drag,
 * or a hover/focus change that requested one), it projects the focused-or-
 * hovered album's current world position with camera.project, converts to
 * CSS px using a cached canvas rect, and writes style.transform/opacity
 * directly onto the DOM tooltip element via the state/tooltipEl.ts bridge.
 * No React state, no CustomEvents.
 */
export function TooltipDriver({ positionsRef, idIndexById }: TooltipDriverProps) {
  const { camera, gl } = useThree();
  const rectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;
    function updateRect() {
      rectRef.current = canvas.getBoundingClientRect();
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [gl]);

  useFrame(() => {
    const el = getTooltipEl();
    if (!el) return;

    const state = useMapStore.getState();
    // Focus wins over hover when both are set.
    const targetId = state.focusedId ?? state.hoveredId;
    if (!targetId) {
      el.style.opacity = "0";
      return;
    }
    const idx = idIndexById.get(targetId);
    const rect = rectRef.current;
    if (idx === undefined || !rect) {
      el.style.opacity = "0";
      return;
    }

    const positions = positionsRef.current;
    const worldX = positions[idx * 2];
    const worldY = positions[idx * 2 + 1];
    const v = new THREE.Vector3(worldX, worldY, 0);
    v.project(camera);
    const screenX = (v.x * 0.5 + 0.5) * rect.width;
    const screenY = (-v.y * 0.5 + 0.5) * rect.height;

    el.style.transform = `translate3d(${screenX}px, ${screenY - 60}px, 0) translate(-50%, 0)`;
    el.style.opacity = "1";
  });

  return null;
}
