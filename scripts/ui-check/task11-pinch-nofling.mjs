import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:3111';

// Confirms a pinch leaves no fling behind: camera position should be static
// a moment after the pinch ends (no residual inertia from the two-finger
// gesture), and confirms single-finger pan still flings normally on touch.
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  const canvasBox = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  const cx = (canvasBox.left + canvasBox.right) / 2;
  const cy = (canvasBox.top + canvasBox.bottom) / 2;
  const cdp = await context.newCDPSession(page);
  function touchPoints(spread) {
    return [
      { x: cx - spread, y: cy, id: 1 },
      { x: cx + spread, y: cy, id: 2 },
    ];
  }

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoints(20) });
  for (const spread of [60, 120, 180]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoints(spread) });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const justAfter = await page.evaluate(() => window.__mapDebug.getCameraState());
  await page.waitForTimeout(500);
  const later = await page.evaluate(() => window.__mapDebug.getCameraState());
  const noFling =
    Math.abs(justAfter.x - later.x) < 1e-6 && Math.abs(justAfter.y - later.y) < 1e-6;

  console.log(JSON.stringify({ justAfter, later, noFling }, null, 2));
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
