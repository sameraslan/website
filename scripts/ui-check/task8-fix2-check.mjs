import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

function labelSnapshot() {
  const spans = Array.from(document.querySelectorAll('span.font-display'));
  return spans.map((s) => ({
    text: s.textContent,
    opacity: parseFloat(s.style.opacity || '0'),
  }));
}

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

async function main() {
  const browser = await chromium.launch();

  // 1. Load state: whole-cloud-visible check + labels + no atlas requests.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const atlasRequests = [];
    page.on('request', (req) => {
      if (/atlas-.*\.webp/.test(req.url())) atlasRequests.push(req.url());
    });
    await page.goto(`${BASE_URL}/music`);
    await page.waitForTimeout(3500);

    const cam = await page.evaluate(() => window.__mapDebug.getCameraState());
    const labels = await page.evaluate(labelSnapshot);

    // Whole-cloud-visible check: project the four corners of the true data
    // extent (the getFullBounds box at the current sliderT) with
    // camera.project and confirm they land within NDC +-0.92.
    const corners = await page.evaluate(() => window.__mapDebug.getCloudCornersNdc());
    const maxAbsNdc = Math.max(...corners.flatMap((c) => [Math.abs(c.x), Math.abs(c.y)]));

    console.log('=== load state ===');
    console.log('camera:', JSON.stringify(cam));
    console.log('labels:', JSON.stringify(labels));
    console.log('atlasRequestsAtLoad:', JSON.stringify(atlasRequests));
    console.log('cloudCornersNdc:', JSON.stringify(corners));
    console.log('maxAbsNdc:', maxAbsNdc, '(pass if <= 0.92)');
    await page.screenshot({ path: 'scripts/ui-check/out/task8fix2-load.png' });
    await context.close();
  }

  // 2. Zoom to ~2.5x fit: covers visible, no labels.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/music`);
    await page.waitForTimeout(3000);
    const camBefore = await page.evaluate(() => window.__mapDebug.getCameraState());
    // Need zoom ~= 2.5 * fitZoom = 2.5 * camBefore.zoom (load zoom == fitZoom).
    const targetZoom = camBefore.zoom * 2.5;
    const factor = targetZoom / camBefore.zoom;
    // WHEEL_SENSITIVITY=0.0015, factor per tick = 1 - deltaY*sensitivity.
    // Solve deltaY for n ticks compounding: use a handful of ticks with a
    // fixed deltaY and just check the result, retrying with more ticks if short.
    let cam = camBefore;
    let ticks = 0;
    while (cam.zoom < targetZoom * 0.95 && ticks < 40) {
      cam = await wheelZoom(page, -80, 2);
      ticks += 2;
    }
    const labels = await page.evaluate(labelSnapshot);
    console.log('=== after zoom to ~2.5x fit ===');
    console.log('fitZoom(load):', camBefore.zoom, 'target:', targetZoom, 'reached:', cam.zoom, 'ticks:', ticks);
    console.log('labels:', JSON.stringify(labels));
    await page.screenshot({ path: 'scripts/ui-check/out/task8fix2-zoomed-2.5x.png' });
    await context.close();
  }

  // 3. Click focus lands at zoom 4.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/music`);
    await page.waitForTimeout(3000);
    const result = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      const point = window.__mapDebug.getNearestScreenPoint();
      canvas.dispatchEvent(new MouseEvent('click', {
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
        cancelable: true,
      }));
      await new Promise((r) => setTimeout(r, 900));
      return { point, camera: window.__mapDebug.getCameraState(), focused: window.__mapDebug.getFocusedAlbumPos() };
    });
    console.log('=== after click-focus ===');
    console.log(JSON.stringify(result));
    await page.screenshot({ path: 'scripts/ui-check/out/task8fix2-focused.png' });
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
