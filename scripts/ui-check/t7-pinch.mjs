import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

// Verifies trackpad pinch (ctrlKey) uses half the wheel sensitivity: one
// ctrlKey wheel tick should move targetZoom half as far as a plain tick with
// the same deltaY.
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  async function oneTick(ctrlKey) {
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await context2.newPage();
    await p.goto(`${BASE_URL}/`);
    await p.waitForTimeout(3000);
    const result = await p.evaluate(async (ctrlKey) => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const px = rect.left + rect.width / 2;
      const py = rect.top + rect.height / 2;
      const before = window.__mapDebug.getCameraState();
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100, clientX: px, clientY: py, bubbles: true, cancelable: true, ctrlKey,
      }));
      // Read on the very next frame, before smoothing has moved zoom far,
      // just to confirm direction; then wait for settle to compare the
      // total distance travelled (== targetZoom - before.zoom).
      await new Promise((r) => setTimeout(r, 1000));
      const after = window.__mapDebug.getCameraState();
      return { before: before.zoom, after: after.zoom, delta: after.zoom - before.zoom };
    }, ctrlKey);
    await context2.close();
    return result;
  }

  const plain = await oneTick(false);
  const pinch = await oneTick(true);
  console.log(JSON.stringify({ plain, pinch, ratio: pinch.delta / plain.delta }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
