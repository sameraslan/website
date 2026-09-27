// Same commit-counter profiler as profile-moves.mjs, but sweeps a small
// circle in the canvas's top-left corner (near the edge feather, sparsely
// populated) instead of the dense center, to get a "definitely no hover
// enter/leave" baseline alongside the existing dense-area run.
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

    // Small circle tight in the top-left corner, well outside the album
    // cloud's bounds.
    const cx = canvasBox.x + 40;
    const cy = canvasBox.y + 40;
    const stepMs = MOVE_DURATION_MS / MOVE_COUNT;
    for (let i = 0; i < MOVE_COUNT; i++) {
      const angle = (i / MOVE_COUNT) * Math.PI * 4;
      const radius = 15;
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
