/**
 * Bridge between the DOM-side Tooltip (rendered outside <Canvas> in
 * MusicMap.tsx) and the canvas-side TooltipDriver (a useFrame inside the
 * fiber tree). Tooltip.tsx registers its root element here on mount;
 * TooltipDriver reads it every frame to write style.transform/opacity
 * directly, skipping React entirely on the hot path. Mirrors the
 * invalidate.ts bridge pattern used for demand-mode renders.
 */
let tooltipEl: HTMLDivElement | null = null;

export function setTooltipEl(el: HTMLDivElement | null): void {
  tooltipEl = el;
}

export function getTooltipEl(): HTMLDivElement | null {
  return tooltipEl;
}
