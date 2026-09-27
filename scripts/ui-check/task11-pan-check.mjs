import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:3111';

// Confirms single-finger touch pan still works after CameraRig's pinch
// rework (regression check): a one-finger drag should move camera.position.
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

  const before = await page.evaluate(() => window.__mapDebug.getCameraState());
  const cdp = await context.newCDPSession(page);
  const canvasBox = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  const cx = (canvasBox.left + canvasBox.right) / 2;
  const cy = (canvasBox.top + canvasBox.bottom) / 2;

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: cx, y: cy, id: 1 }],
  });
  for (const dx of [20, 40, 60, 80, 100]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx + dx, y: cy, id: 1 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(50);
  const justAfter = await page.evaluate(() => window.__mapDebug.getCameraState());
  await page.waitForTimeout(600);
  const later = await page.evaluate(() => window.__mapDebug.getCameraState());

  console.log(
    JSON.stringify(
      {
        before,
        justAfter,
        later,
        panned: justAfter.x !== before.x,
        flungFurther: later.x !== justAfter.x,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
