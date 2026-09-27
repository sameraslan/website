import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

async function main() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(4000);

    const pt = await page.evaluate(() => window.__mapDebug.getNearestScreenPoint());
    if (!pt) throw new Error('no nearest point');

    await page.mouse.move(pt.x, pt.y);
    // The spec's hover delay is 80ms; headless Chromium's software GL path
    // (no real GPU) adds significant macrotask jitter on top of that in this
    // environment, so the verification wait is generous.
    await page.waitForTimeout(1000);

    const cursor = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return getComputedStyle(c).cursor;
    });

    const tooltip = await page.evaluate(() => {
      const el = document.querySelector('[data-tooltip="hover"]');
      if (!el) return null;
      return {
        opacity: getComputedStyle(el).opacity,
        text: el.textContent,
        transform: el.style.transform,
      };
    });

    console.log(JSON.stringify({ cursor, tooltip }, null, 2));

    await page.screenshot({ path: 'scripts/ui-check/out/task6-hover-ring.png' });
    await page.screenshot({
      path: 'scripts/ui-check/out/task6-hover-ring-zoom.png',
      clip: { x: Math.max(0, pt.x - 60), y: Math.max(0, pt.y - 60), width: 120, height: 120 },
    });

    // Move mouse away to empty space, verify tooltip hides and cursor resets.
    await page.mouse.move(50, 50);
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const el = document.querySelector('[data-tooltip="hover"]');
      return {
        cursor: getComputedStyle(c).cursor,
        opacity: el ? getComputedStyle(el).opacity : null,
      };
    });
    console.log('after-leave:', JSON.stringify(after));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
