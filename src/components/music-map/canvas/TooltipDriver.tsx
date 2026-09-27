"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { renderedSpriteCssSize } from "../shaders/album";
import { useMapStore } from "../state/store";
import { getTooltipEl, tooltipTargetId, type TooltipKind } from "../state/tooltipEl";
import { getOverviewFraming } from "../state/view";

const KINDS: readonly TooltipKind[] = ["focus", "hover"];
/** Gap between a sprite's edge and its label, in CSS px. */
const LABEL_GAP_PX = 6;
/** Minimum distance a label keeps from the canvas edges, in CSS px. */
const EDGE_MARGIN_PX = 4;

interface TooltipDriverProps {
  /** Flat [x0,y0,x1,y1,...] interpolated positions, maintained by AlbumField. */
  positionsRef: React.MutableRefObject<Float32Array>;
  /** id -> index into positionsRef, built once from data.positions. */
  idIndexById: Map<string, number>;
}

/**
 * Lives inside the canvas tree. Every rendered frame (fly-to, drift, drag,
 * or a hover/focus change that requested one), it projects each labelled
 * album's current world position with camera.project, converts to CSS px
 * using the canvas size, and writes style.transform/opacity directly
 * onto the DOM tooltip elements via the state/tooltipEl.ts bridge. No React
 * state, no CustomEvents.
 *
 * A label sits just above its sprite's drawn edge (same size maths as the
 * vertex shader, so a 90px cover is not hidden under its own label), flips
 * below when there is no room above, and is clamped inside the canvas.
 */
export function TooltipDriver({ positionsRef, idIndexById }: TooltipDriverProps) {
  const { camera, gl } = useThree();

  useFrame((state) => {
    const { focusedId, hoveredId } = useMapStore.getState();
    const rect = state.size;
    const cam = camera as THREE.OrthographicCamera;
    // Where the focus label landed this frame (KINDS runs it first), so the
    // hover label can keep clear of it.
    let focusBox: { left: number; top: number; right: number; bottom: number } | null = null;

    for (const kind of KINDS) {
      const el = getTooltipEl(kind);
      if (!el) continue;
      const targetId = tooltipTargetId(kind, focusedId, hoveredId);
      const idx = targetId ? idIndexById.get(targetId) : undefined;
      // An empty element means React hasn't committed this target's text
      // yet; showing it would flash an empty pill for a frame.
      if (idx === undefined || !el.textContent) {
        el.style.opacity = "0";
        continue;
      }

      const positions = positionsRef.current;
      const v = new THREE.Vector3(positions[idx * 2], positions[idx * 2 + 1], 0);
      v.project(cam);
      const screenX = (v.x * 0.5 + 0.5) * rect.width;
      const screenY = (-v.y * 0.5 + 0.5) * rect.height;

      // Per-instance scale from the vertex shader: hovered 1.25, focused
      // (always in its own highlight set) 1.15.
      const scale = targetId === hoveredId ? 1.25 : 1.15;
      const radius =
        renderedSpriteCssSize(
          cam.zoom,
          getOverviewFraming().zoom,
          rect.height,
          gl.getPixelRatio(),
          scale,
        ) / 2;

      // A focused album panned off the canvas takes its label with it,
      // rather than leaving it clamped to the edge labelling nothing.
      if (
        screenX < -radius ||
        screenX > rect.width + radius ||
        screenY < -radius ||
        screenY > rect.height + radius
      ) {
        el.style.opacity = "0";
        continue;
      }

      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const maxLeft = Math.max(EDGE_MARGIN_PX, rect.width - w - EDGE_MARGIN_PX);
      const left = Math.min(maxLeft, Math.max(EDGE_MARGIN_PX, screenX - w / 2));
      const above = screenY - radius - LABEL_GAP_PX - h;
      const below = screenY + radius + LABEL_GAP_PX;
      let top = above < EDGE_MARGIN_PX ? below : above;
      // A hovered neighbour right next to the focused album would put its
      // label on top of the focus label and hide which album is focused:
      // try the other side of the hovered sprite, and failing that stack it
      // just above the focus label.
      if (kind === "hover" && focusBox) {
        const box = focusBox;
        const hits = (t: number) =>
          left < box.right && left + w > box.left && t < box.bottom && t + h > box.top;
        if (hits(top)) {
          const other = top === above ? below : above;
          top = !hits(other) && other >= EDGE_MARGIN_PX ? other : box.top - h - LABEL_GAP_PX;
        }
      }
      if (kind === "focus") focusBox = { left, top, right: left + w, bottom: top + h };

      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      el.style.opacity = "1";
    }
  });

  return null;
}
