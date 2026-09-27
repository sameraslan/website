import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

async function run(page, waitAfterMs) {
  return page.evaluate(async (waitAfterMs) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const px = rect.left + rect.width / 2 + 100;
    const py = rect.top + rect.height / 2;

    const before = window.__mapDebug.getCameraState();
    const worldBefore = window.__mapDebug.getWorldAt(px, py);

    for (let i = 0; i < 3; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100,
        clientX: px,
        clientY: py,
        bubbles: true,
        cancelable: true,
      }));
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, waitAfterMs));

    const after = window.__mapDebug.getCameraState();
    const worldAfter = window.__mapDebug.getWorldAt(px, py);

    const worldPerPxX = 1.5 / (after.zoom * rect.width);
    const worldPerPxY = 1.1 / (after.zoom * rect.height);
    const dxWorld = worldAfter.x - worldBefore.x;
    const dyWorld = worldAfter.y - worldBefore.y;
    const driftPxX = dxWorld / worldPerPxX;
    const driftPxY = dyWorld / worldPerPxY;

    return { before, after, worldBefore, worldAfter, driftPxX, driftPxY };
  }, waitAfterMs);
}

async function main() {
  const browser = await chromium.launch();

  // Case 1: brief's prescribed 600ms wait after the last wheel tick.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(3000);
    const result = await run(page, 600);
    console.log('=== wait 600ms after last wheel (brief-prescribed) ===');
    console.log(JSON.stringify(result, null, 2));
    await context.close();
  }

  // Case 2: 400ms wait, inside CameraBounds' 500ms release window, isolating
  // the zoom-anchor behavior from the pre-existing idle-recenter bug.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(3000);
    const result = await run(page, 400);
    console.log('=== wait 400ms after last wheel (isolates zoom-anchor only) ===');
    console.log(JSON.stringify(result, null, 2));
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
