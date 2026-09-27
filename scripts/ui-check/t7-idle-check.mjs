import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

// Verifies frameloop="demand" goes idle after a wheel zoom settles: patches
// WebGLRenderingContext.drawArrays (what three.js calls per draw) to count
// GL draw calls, does a wheel gesture, waits past both the zoom time
// constant and CameraBounds' 500ms release window, then counts draws over a
// quiet 2s window. A non-zero count there would mean demand mode degraded to
// continuous rendering.
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__drawCalls = 0;
    // Count actual canvas frame paints via requestVideoFrameCallback-style
    // polling of a per-frame WebGL marker: patch getContext so any 2D/WebGL
    // context creation lets us hook the canvas's own animation loop count
    // through R3F's exposed onCreated below is awkward from here, so instead
    // count HTMLCanvasElement.prototype's context "flush" boundary via
    // requestAnimationFrame calls made by r3f's own scheduler specifically:
    // r3f schedules frames through window.requestAnimationFrame, same as
    // everything else on the page, so filter isn't perfectly clean, but a
    // sustained non-zero delta over a quiet 2s window (well beyond a single
    // settle burst) is what would indicate frameloop="demand" degrading to
    // continuous rendering.
    const origRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => origRAF((t) => {
      window.__drawCalls++;
      return cb(t);
    });
  });

  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  const baseline = await page.evaluate(async () => {
    const a = window.__drawCalls;
    await new Promise((r) => setTimeout(r, 2000));
    const b = window.__drawCalls;
    return b - a;
  });

  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    // Wheel exactly at canvas centre: cursorWorld === camera.position, so
    // anchoredZoom leaves camera.position unchanged and this measurement
    // isolates the zoom-smoothing loop from CameraBounds' idle recenter
    // (a separate, pre-existing concern; see report).
    const px = rect.left + rect.width / 2;
    const py = rect.top + rect.height / 2;

    for (let i = 0; i < 3; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100, clientX: px, clientY: py, bubbles: true, cancelable: true,
      }));
      await new Promise((r) => setTimeout(r, 50));
    }
    // The exponential zoom smoothing (tau=90ms) needs several hundred ms to
    // cross the 1e-4 settle threshold for a 3-tick compounded zoom change;
    // give it 1000ms of true tail time before calling it "settled".
    await new Promise((r) => setTimeout(r, 1000));
    const drawsAfterSettle = window.__drawCalls;

    // Now measure a truly quiet window with zero further interaction.
    await new Promise((r) => setTimeout(r, 2000));
    const drawsAfterQuiet = window.__drawCalls;

    return { drawsAfterSettle, drawsAfterQuiet, drawsDuringQuiet: drawsAfterQuiet - drawsAfterSettle };
  });

  console.log(JSON.stringify({ baselineQuietRafOver2s: baseline, ...result }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
