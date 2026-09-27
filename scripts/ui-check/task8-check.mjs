import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

async function wheelZoom(page, deltaYPerTick, ticks) {
  return page.evaluate(async ({ deltaYPerTick, ticks }) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const px = rect.left + rect.width / 2;
    const py = rect.top + rect.height / 2;
    for (let i = 0; i < ticks; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: deltaYPerTick,
        clientX: px,
        clientY: py,
        bubbles: true,
        cancelable: true,
      }));
      await new Promise((r) => setTimeout(r, 40));
    }
    await new Promise((r) => setTimeout(r, 400));
    return window.__mapDebug.getCameraState();
  }, { deltaYPerTick, ticks });
}

function labelSnapshot() {
  const spans = Array.from(document.querySelectorAll('span.font-display'));
  return spans.map((s) => ({
    text: s.textContent,
    opacity: parseFloat(s.style.opacity || '0'),
  }));
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/music`);
  await page.waitForTimeout(3000);

  // 1. Zoom OUT to a low zoomT so labels should be at/near full opacity.
  const camAfterOut = await wheelZoom(page, 100, 25); // deltaY > 0 zooms out
  const labelsOut = await page.evaluate(labelSnapshot);
  console.log('=== after zoom OUT ===');
  console.log('camera:', JSON.stringify(camAfterOut));
  console.log('labels:', JSON.stringify(labelsOut));
  await page.screenshot({ path: 'scripts/ui-check/out/task8-zoomed-out.png' });

  // 2. Zoom IN past 40 CSS px sprite size and past zoomT 0.45.
  const camAfterIn = await wheelZoom(page, -100, 60);
  const labelsIn = await page.evaluate(labelSnapshot);
  const spriteInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return { dpr: window.devicePixelRatio };
  });
  console.log('=== after zoom IN ===');
  console.log('camera:', JSON.stringify(camAfterIn));
  console.log('labels:', JSON.stringify(labelsIn));
  console.log('dpr:', JSON.stringify(spriteInfo));
  await page.screenshot({ path: 'scripts/ui-check/out/task8-zoomed-in.png' });

  // 3. Click an album (using the dev getter) and confirm dimming.
  const point = await page.evaluate(() => window.__mapDebug.getNearestScreenPoint());
  if (point) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'scripts/ui-check/out/task8-focused.png' });
  console.log('=== after click ===');
  console.log('clickedPoint:', JSON.stringify(point));

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
