/**
 * Bridge between the DOM-side Tooltips (rendered outside <Canvas> in
 * MusicMap.tsx) and the canvas-side TooltipDriver (a useFrame inside the
 * fiber tree). Each Tooltip registers its root element here on mount, keyed
 * by kind; TooltipDriver reads them every frame to write
 * style.transform/opacity directly, skipping React entirely on the hot path.
 * Mirrors the invalidate.ts bridge pattern used for demand-mode renders.
 *
 * Two kinds: "focus" is pinned to the clicked album for as long as it stays
 * focused; "hover" follows the album under the mouse, and only shows when
 * that is a different album, so the neighbours of a focused album can be
 * read one by one while the focused album keeps its label.
 */
export type TooltipKind = "focus" | "hover";

const tooltipEls: Record<TooltipKind, HTMLDivElement | null> = {
  focus: null,
  hover: null,
};

export function setTooltipEl(kind: TooltipKind, el: HTMLDivElement | null): void {
  tooltipEls[kind] = el;
}

export function getTooltipEl(kind: TooltipKind): HTMLDivElement | null {
  return tooltipEls[kind];
}

/** Which album a tooltip of this kind labels right now, or null. */
export function tooltipTargetId(
  kind: TooltipKind,
  focusedId: string | null,
  hoveredId: string | null,
): string | null {
  if (kind === "focus") return focusedId;
  return hoveredId !== focusedId ? hoveredId : null;
}
