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

  // 1. Load state: track atlas-*.webp requests from the very start.
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
    console.log('=== load state ===');
    console.log('camera:', JSON.stringify(cam));
    console.log('labels:', JSON.stringify(labels));
    console.log('atlasRequestsAtLoad:', JSON.stringify(atlasRequests));
    await page.screenshot({ path: 'scripts/ui-check/out/task8fix1-load.png' });

    // 2. Pointermove frame timing at overview.
    const timing = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const frameTimes = [];
      let last = performance.now();
      function onFrame(t) {
        frameTimes.push(t - last);
        last = t;
      }
      let raf;
      function loop(t) {
        onFrame(t);
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
      for (let i = 0; i < 30; i++) {
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx + (i % 15) * 4,
          clientY: cy + (i % 10) * 3,
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          isPrimary: true,
        }));
        await new Promise((r) => setTimeout(r, 16));
      }
      await new Promise((r) => setTimeout(r, 100));
      cancelAnimationFrame(raf);
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      return { avg, p95, max: Math.max(...frameTimes), count: frameTimes.length };
    });
    console.log('pointermoveFrameTiming(ms):', JSON.stringify(timing));

    await context.close();
  }

  // 3. Zoom to ~3.5 at centre: covers visible, labels hidden.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/music`);
    await page.waitForTimeout(3000);
    // zoom is exponential-smoothed toward target; use enough ticks / wait.
    const cam = await wheelZoom(page, -60, 5);
    await page.waitForTimeout(300);
    const cam2 = await page.evaluate(() => window.__mapDebug.getCameraState());
    const labels = await page.evaluate(labelSnapshot);
    console.log('=== after zoom to ~3.5 ===');
    console.log('camera:', JSON.stringify(cam2));
    console.log('labels:', JSON.stringify(labels));
    await page.screenshot({ path: 'scripts/ui-check/out/task8fix1-zoomed-3.5.png' });
    await context.close();
  }

  // 4. Click focuses at zoom 4.0 with a readable cover.
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
    await page.screenshot({ path: 'scripts/ui-check/out/task8fix1-focused.png' });
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
