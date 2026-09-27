// Task 8 fix round 3 verification: percentile-fit overview framing.
// Usage: node scripts/ui-check/task8-fix3-check.mjs (dev server on :3111).
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';
const OUT = 'scripts/ui-check/out';
const VIEWPORT = { width: 1440, height: 900 };

function labelSnapshot() {
  const canvas = document.querySelector('canvas');
  const r = canvas.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return Array.from(document.querySelectorAll('span.font-display'))
    .map((s) => {
      const b = s.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      // Offset from the canvas centre as a fraction of the half-size: inside
      // the middle 80% of the canvas means |fx| <= 0.8 and |fy| <= 0.8.
      return {
        text: s.textContent,
        opacity: parseFloat(s.style.opacity || '0'),
        dxPx: Math.round(x - cx),
        dyPx: Math.round(y - cy),
        fx: +((x - cx) / (r.width / 2)).toFixed(3),
        fy: +((y - cy) / (r.height / 2)).toFixed(3),
      };
    })
    .filter((l) => l.opacity > 0);
}

async function open(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const atlas = [];
  page.on('request', (req) => {
    if (/atlas-.*\.webp/.test(req.url())) atlas.push(req.url().split('/').pop());
  });
  await page.goto(`${BASE_URL}/music`);
  await page.waitForFunction(() => window.__mapDebug?.getFitState, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  return { context, page, atlas };
}

async function wheelAtCentre(page, deltaY, ticks) {
  return page.evaluate(async ({ deltaY, ticks }) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const px = r.left + r.width / 2;
    const py = r.top + r.height / 2;
    for (let i = 0; i < ticks; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY, clientX: px, clientY: py, bubbles: true, cancelable: true,
      }));
      await new Promise((res) => setTimeout(res, 40));
    }
    await new Promise((res) => setTimeout(res, 500));
    return window.__mapDebug.getCameraState();
  }, { deltaY, ticks });
}

async function main() {
  const browser = await chromium.launch();

  // 1. Load state.
  {
    const { context, page, atlas } = await open(browser);
    const r = await page.evaluate(() => ({
      camera: window.__mapDebug.getCameraState(),
      fit: window.__mapDebug.getFitState(),
      ndcInside: window.__mapDebug.getNdcInsideFraction(),
      sliderT: window.__mapDebug.getSliderT(),
      canvas: (() => {
        const b = document.querySelector('canvas').getBoundingClientRect();
        return { left: b.left, top: b.top, width: b.width, height: b.height };
      })(),
    }));
    const labels = await page.evaluate(labelSnapshot);
    const dPos = Math.hypot(r.camera.x - r.fit.center.x, r.camera.y - r.fit.center.y);
    console.log('=== 1. load ===');
    console.log(JSON.stringify(r));
    console.log('camera-centre distance:', dPos, 'zoom - fitZoom:', r.camera.zoom - r.fit.fitZoom);
    console.log('labels:', JSON.stringify(labels));
    console.log('atlas requests at load:', JSON.stringify(atlas));
    await page.screenshot({ path: `${OUT}/task8fix3-load.png` });
    await context.close();
  }

  // 2. Wheel zoom at the canvas centre to ~2.5x fit.
  {
    const { context, page, atlas } = await open(browser);
    const before = await page.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect();
      return {
        camera: window.__mapDebug.getCameraState(),
        fit: window.__mapDebug.getFitState(),
        worldAtCentre: window.__mapDebug.getWorldAt(c.left + c.width / 2, c.top + c.height / 2),
      };
    });
    const target = before.fit.fitZoom * 2.5;
    let cam = before.camera;
    let ticks = 0;
    while (cam.zoom < target * 0.98 && ticks < 60) {
      cam = await wheelAtCentre(page, -60, 1);
      ticks += 1;
    }
    const after = await page.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect();
      return window.__mapDebug.getWorldAt(c.left + c.width / 2, c.top + c.height / 2);
    });
    // Give atlases time to download and decode.
    await page.waitForTimeout(5000);
    const labels = await page.evaluate(labelSnapshot);
    console.log('=== 2. wheel zoom at centre ===');
    console.log('fitZoom', before.fit.fitZoom, 'target', target, 'reached', cam.zoom,
      'ratio', cam.zoom / before.fit.fitZoom, 'ticks', ticks);
    console.log('world under cursor before', JSON.stringify(before.worldAtCentre), 'after', JSON.stringify(after),
      'drift', Math.hypot(after.x - before.worldAtCentre.x, after.y - before.worldAtCentre.y));
    console.log('visible labels:', JSON.stringify(labels));
    console.log('atlas requests:', JSON.stringify(atlas));
    await page.screenshot({ path: `${OUT}/task8fix3-zoom2.5x.png` });
    await context.close();
  }

  // 3. Click focus on an album near the canvas centre, lands at zoom 4.
  {
    const { context, page, atlas } = await open(browser);
    const point = await page.evaluate(() => {
      // Scan a small spiral around the canvas centre for a pixel that is not
      // paper, so the click lands on a real dot inside the bulk.
      const c = document.querySelector('canvas').getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    });
    // Hover first so CursorTracker resolves a target, then click.
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(200);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(1200);
    let focused = await page.evaluate(() => window.__mapDebug.getFocusedAlbumPos());
    if (!focused) {
      // Centre pixel was empty paper: fall back to scanning outward.
      for (const [dx, dy] of [[12, 0], [-12, 0], [0, 12], [0, -12], [24, 24], [-24, -24], [30, -10]]) {
        await page.mouse.click(point.x + dx, point.y + dy);
        await page.waitForTimeout(1200);
        focused = await page.evaluate(() => window.__mapDebug.getFocusedAlbumPos());
        if (focused) break;
      }
    }
    await page.waitForTimeout(5000);
    const cam = await page.evaluate(() => window.__mapDebug.getCameraState());
    console.log('=== 3. click focus ===');
    console.log('focused album pos', JSON.stringify(focused), 'camera', JSON.stringify(cam));
    console.log('atlas requests:', JSON.stringify(atlas));
    await page.screenshot({ path: `${OUT}/task8fix3-focus.png` });
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
