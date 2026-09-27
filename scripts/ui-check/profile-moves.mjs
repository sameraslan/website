#!/usr/bin/env node
// Commit-counter profiler: dispatches synthetic pointermove events over the
// music map canvas and reads window.__mapCommits (a dev-only counter bumped
// once per SceneInner React commit, see src/components/music-map/state/debug.ts)
// before and after. Used to verify the hot path stops re-rendering React on
// pointermove once refs replace useState for cursor/zoom (Task 5).
//
// Usage:
//   node scripts/ui-check/profile-moves.mjs
//
// Prints {"before": N, "after": N, "delta": N} as a single JSON line.

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';
const SETTLE_MS = 4000;
const MOVE_COUNT = 60;
const MOVE_DURATION_MS = 1000;

async function main() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(SETTLE_MS);

    const canvasBox = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });
    if (!canvasBox) {
      throw new Error('No <canvas> found on the page; is the music map mounted?');
    }

    const before = await page.evaluate(() => window.__mapCommits ?? 0);

    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    const stepMs = MOVE_DURATION_MS / MOVE_COUNT;
    for (let i = 0; i < MOVE_COUNT; i++) {
      const angle = (i / MOVE_COUNT) * Math.PI * 4;
      const radius = Math.min(canvasBox.width, canvasBox.height) * 0.25;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      await page.mouse.move(x, y);
      await page.waitForTimeout(stepMs);
    }

    const after = await page.evaluate(() => window.__mapCommits ?? 0);

    const result = { before, after, delta: after - before };
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
