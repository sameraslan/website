import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

// Verifies the CameraBounds fix: a manual pan or zoom-out that still leaves
// most of the album cloud in view must NOT be undone by the idle recenter,
// even well past its 500ms release window.
async function panCheck(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    const before = window.__mapDebug.getCameraState();

    function firePointer(type, x, y, opts = {}) {
      canvas.dispatchEvent(new PointerEvent(type, {
        clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true,
        button: 0, buttons: 1, ...opts,
      }));
    }

    firePointer('pointerdown', startX, startY);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (300 * i) / steps;
      firePointer('pointermove', x, startY);
      await new Promise((r) => setTimeout(r, 16));
    }
    firePointer('pointerup', startX + 300, startY, { buttons: 0 });

    const justAfter = window.__mapDebug.getCameraState();
    await new Promise((r) => setTimeout(r, 2000));
    const afterWait = window.__mapDebug.getCameraState();

    return { before, justAfter, afterWait };
  });

  await context.close();
  return result;
}

async function zoomOutCheck(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const px = rect.left + rect.width / 2;
    const py = rect.top + rect.height / 2;

    const before = window.__mapDebug.getCameraState();

    // Zoom out hard (positive deltaY) toward the MIN_ZOOM floor of 0.5.
    for (let i = 0; i < 10; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 200, clientX: px, clientY: py, bubbles: true, cancelable: true,
      }));
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 1500));
    const settled = window.__mapDebug.getCameraState();
    await new Promise((r) => setTimeout(r, 2000));
    const afterWait = window.__mapDebug.getCameraState();

    return { before, settled, afterWait };
  });

  await context.close();
  return result;
}

async function main() {
  const browser = await chromium.launch();
  const pan = await panCheck(browser);
  console.log('=== pan 300px right, wait 2s ===');
  console.log(JSON.stringify(pan, null, 2));

  const zoomOut = await zoomOutCheck(browser);
  console.log('=== zoom out toward 0.5, wait 2s ===');
  console.log(JSON.stringify(zoomOut, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
