export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** Symmetric ease: slow start, slow end. Reads as a gentle, even glide. */
export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** sliderT ∈ [0, 1] mapped piecewise-linearly between three stops. */
export function interpolatePosition(
  audio: readonly [number, number],
  balanced: readonly [number, number],
  mood: readonly [number, number],
  t: number,
): [number, number] {
  if (t <= 0.5) {
    const localT = t * 2;
    return [
      audio[0] + (balanced[0] - audio[0]) * localT,
      audio[1] + (balanced[1] - audio[1]) * localT,
    ];
  }
  const localT = (t - 0.5) * 2;
  return [
    balanced[0] + (mood[0] - balanced[0]) * localT,
    balanced[1] + (mood[1] - balanced[1]) * localT,
  ];
}

export function kNearestNeighbors(
  targetId: string,
  positions: Map<string, readonly [number, number]>,
  k: number,
): string[] {
  const target = positions.get(targetId);
  if (!target) return [];
  const distances: { id: string; d2: number }[] = [];
  for (const [id, p] of positions) {
    if (id === targetId) continue;
    const dx = p[0] - target[0];
    const dy = p[1] - target[1];
    distances.push({ id, d2: dx * dx + dy * dy });
  }
  distances.sort((a, b) => a.d2 - b.d2);
  return distances.slice(0, k).map((x) => x.id);
}

export function nearestAlbumIndex(
  positions: { id: string; audio: [number, number]; balanced: [number, number]; mood: [number, number] }[],
  worldX: number,
  worldY: number,
  sliderT: number,
  maxDistance: number,
): number {
  let best = -1;
  let bestD2 = maxDistance * maxDistance;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const [x, y] = interpolatePosition(p.audio, p.balanced, p.mood, sliderT);
    const dx = x - worldX;
    const dy = y - worldY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}
