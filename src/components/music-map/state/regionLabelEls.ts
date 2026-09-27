/**
 * Bridge between the DOM-side region labels (rendered outside <Canvas> in
 * MusicMap.tsx, see overlays/RegionLabels.tsx) and the canvas-side driver
 * (canvas/RegionLabels.tsx) that positions them every frame. Mirrors the
 * single-element tooltipEl.ts bridge, but keyed by clusterId since there is
 * one label per region.
 */
const elsByClusterId = new Map<number, HTMLSpanElement>();

export function registerRegionLabelEl(clusterId: number, el: HTMLSpanElement | null): void {
  if (el) {
    elsByClusterId.set(clusterId, el);
  } else {
    elsByClusterId.delete(clusterId);
  }
}

export function getRegionLabelEl(clusterId: number): HTMLSpanElement | null {
  return elsByClusterId.get(clusterId) ?? null;
}
