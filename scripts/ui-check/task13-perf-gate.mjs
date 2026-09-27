// Task 13 performance gate: click-to-settle time, first draw, and renderer
// texture growth, against a production build (npx next start -p 3112) with
// NEXT_PUBLIC_MAP_DEBUG=1 baked in so window.__mapDebug is available.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3112';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

// Wait for data + first draw.
await page.waitForFunction(() => !!window.__mapDebug?.getNearestScreenPoint?.(), {
  timeout: 15000,
});

const firstDrawAt = await page.evaluate(() => window.__mapDebug?.firstDrawAt ?? null);
const navStart = await page.evaluate(
  () => performance.timing?.navigationStart ?? performance.timeOrigin,
);
console.log('firstDrawAt (ms, performance.now-based):', firstDrawAt);

// Texture count before first zoom.
const texturesBeforeZoom = await page.evaluate(() => window.__mapDebug.getRendererInfo().textures);
console.log('textures before first zoom:', texturesBeforeZoom);

// Click-to-settle: dispatch pointerdown/up on a dense point, poll zoom.
// getNearestScreenPoint doesn't know about the overlaid header (z-20 over
// the top ~64px of the canvas on desktop), so grid-search a handful of
// on-canvas points below it for one that actually focuses an album, same
// approach as scripts/ui-check/task11-touch-check.mjs's touch equivalent.
const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
// Polling from Node via separate page.evaluate() round trips adds tens of ms
// of CDP/IPC overhead per call, which dwarfs the real in-page latency this
// is trying to measure. Instead, arm an in-page poll (via performance.now(),
// entirely inside the browser) right before dispatching pointerdown/up, and
// read back its result in one call after it resolves.
let settled = false;
let elapsed = 0;
outer: for (const fx of [0.3, 0.4, 0.5, 0.6, 0.7]) {
  for (const fy of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    const x = box.x + fx * box.width;
    const y = box.y + fy * box.height;
    const el = await page.evaluate(([px, py]) => {
      const e = document.elementFromPoint(px, py);
      return e ? e.tagName : null;
    }, [x, y]);
    if (el !== 'CANVAS') continue;

    const pollPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        // t0 is the real pointerup timestamp, not this evaluate() call's own
        // (which would run slightly before Node dispatches the click,
        // inflating the measurement by that CDP round trip).
        let t0 = null;
        window.addEventListener(
          'pointerup',
          () => {
            t0 = performance.now();
          },
          { once: true, capture: true },
        );
        let focused = false;
        function tick() {
          if (t0 === null) return requestAnimationFrame(tick);
          const now = performance.now();
          if (!focused) {
            focused = !!window.__mapDebug.getFocusedAlbumPos?.();
            if (!focused && now - t0 > 150) return resolve({ hit: false });
          }
          if (focused) {
            const zoom = window.__mapDebug.getCameraState().zoom;
            if (Math.abs(zoom - 4.0) < 0.01) return resolve({ hit: true, elapsed: now - t0 });
          }
          if (now - t0 > 2000) return resolve({ hit: focused, elapsed: null });
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    });
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    const result = await pollPromise;
    if (result.hit && result.elapsed !== null) {
      elapsed = result.elapsed;
      settled = true;
      break outer;
    }
  }
}
console.log('click-to-settle (ms):', settled ? elapsed.toFixed(1) : 'DID NOT SETTLE (no grid point focused an album, or zoom never reached 4.0)');

// Texture growth after zoom: wait a bit for atlas load then recheck.
await page.waitForTimeout(1500);
const texturesAfterZoom = await page.evaluate(() => window.__mapDebug.getRendererInfo().textures);
console.log('textures after first zoom (+1.5s):', texturesAfterZoom);

await browser.close();

console.log('---');
console.log('Summary:');
console.log('  click-to-settle:', settled ? `${elapsed}ms (target <700ms)` : 'FAILED to settle');
console.log('  firstDrawAt:', firstDrawAt !== null ? `${firstDrawAt.toFixed(1)}ms (target <1500ms)` : 'unavailable');
console.log('  textures before zoom:', texturesBeforeZoom, '(target 0-1)');
console.log('  textures after zoom:', texturesAfterZoom, '(expect it grew)');
