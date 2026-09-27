import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

// Verifies pointer capture: a drag that leaves the canvas bounds keeps
// panning until pointerup, instead of stopping at pointerleave (spec 4.4.5).
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    // Well beyond the canvas's right edge.
    const endX = rect.right + 300;
    const endY = startY;

    const before = window.__mapDebug.getCameraState();

    function firePointer(type, x, y, opts = {}) {
      canvas.dispatchEvent(new PointerEvent(type, {
        clientX: x,
        clientY: y,
        pointerId: 1,
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        ...opts,
      }));
    }

    firePointer('pointerdown', startX, startY);
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const x = startX + ((endX - startX) * i) / steps;
      firePointer('pointermove', x, startY);
      await new Promise((r) => setTimeout(r, 16));
    }
    // Beyond the canvas now; leaving should NOT end the drag (capture holds).
    canvas.dispatchEvent(new PointerEvent('pointerleave', {
      clientX: endX, clientY: endY, pointerId: 1, bubbles: true,
    }));
    await new Promise((r) => setTimeout(r, 16));
    const midDrag = window.__mapDebug.getCameraState();

    // One more move past the canvas edge, still captured.
    firePointer('pointermove', endX + 50, startY);
    await new Promise((r) => setTimeout(r, 16));

    firePointer('pointerup', endX + 50, startY, { buttons: 0 });
    await new Promise((r) => setTimeout(r, 100));
    const after = window.__mapDebug.getCameraState();

    return { before, midDrag, after, totalDx: after.x - before.x };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
