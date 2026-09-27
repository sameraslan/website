/**
 * Dot colours for the album shader's `u_clusterColors[8]` uniform, built from
 * the data's own regions (public/data/regions.json) so the dots and the
 * region labels (which use `region.color`) always agree. Replaces a
 * hardcoded table in shaders/album.ts that had drifted out of order and
 * painted the terracotta "soul" cluster sage.
 */

export type Rgb01 = [number, number, number];

/** Neutral grey, used only when the data has no regions at all. */
const FALLBACK: Rgb01 = [0.5, 0.5, 0.5];

/** Parses `#rrggbb` into 0..1 floats (sRGB-authored, written unconverted). */
export function hexToRgb01(hex: string): Rgb01 {
  const h = hex.replace(/^#/, "");
  const v = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}

/**
 * One colour per clusterId, sorted by clusterId, always exactly `count`
 * entries (the shader's fixed array size); pads with the last colour when
 * the data has fewer regions.
 */
export function clusterColorsFromRegions(
  regions: readonly { clusterId: number; color: string }[],
  count = 8,
): Rgb01[] {
  const sorted = [...regions].sort((a, b) => a.clusterId - b.clusterId);
  const out: Rgb01[] = [];
  for (let i = 0; i < count; i++) {
    const r = sorted[Math.min(i, sorted.length - 1)];
    out.push(r ? hexToRgb01(r.color) : [...FALLBACK]);
  }
  return out;
}
