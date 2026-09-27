// Task 8 fix round 5 verification: sprite size from the live uniforms at load
// and at focus zoom 4, and the tooltip after a click-to-focus settles.
// Usage: node scripts/ui-check/task8-fix5-check.mjs [--gpu] (dev server :3111).
// --gpu launches headed Chromium with the platform GPU backend instead of
// the default headless renderer, to compare ALIASED_POINT_SIZE_RANGE.
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';
const OUT = 'scripts/ui-check/out';
const gpu = process.argv.includes('--gpu');
const tag = gpu ? 'gpu' : 'headless';

function tooltipState() {
  const el = document.querySelector('[role="status"][aria-live="polite"]');
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return {
    opacity: el.style.opacity,
    computedOpacity: getComputedStyle(el).opacity,
    text: el.textContent,
    rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
  };
}

function renderer() {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

async function main() {
  const browser = await chromium.launch(gpu ? { headless: false, args: ['--enable-gpu', '--ignore-gpu-blocklist'] } : {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: gpu ? 2 : 1 });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/music`);
  await page.waitForFunction(() => window.__mapDebug?.getSpriteCssSize && window.__mapDebug?.getFitState, null, { timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log(`=== [${tag}] renderer:`, await page.evaluate(renderer));
  console.log(`=== [${tag}] load sprite size:`, JSON.stringify(await page.evaluate(() => window.__mapDebug.getSpriteCssSize())));
  console.log(`=== [${tag}] load tooltip:`, JSON.stringify(await page.evaluate(tooltipState)));
  await page.screenshot({ path: `${OUT}/task8fix5-${tag}-load.png` });

  // Click an album near the canvas centre (real mouse: move then click), then
  // wait for the 550ms glide to settle.
  const c = await page.evaluate(() => {
    const b = document.querySelector('canvas').getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  let focused = null;
  for (const [dx, dy] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [24, 24]]) {
    await page.mouse.click(c.x + dx, c.y + dy);
    await page.waitForTimeout(300);
    focused = await page.evaluate(() => window.__mapDebug.getFocusedAlbumPos());
    if (focused) break;
  }
  await page.waitForTimeout(1500);
  console.log(`=== [${tag}] focused:`, JSON.stringify(focused), 'camera', JSON.stringify(await page.evaluate(() => window.__mapDebug.getCameraState())));
  console.log(`=== [${tag}] focus sprite size:`, JSON.stringify(await page.evaluate(() => window.__mapDebug.getSpriteCssSize())));
  console.log(`=== [${tag}] focus tooltip (cursor still on album):`, JSON.stringify(await page.evaluate(tooltipState)));

  // Move the mouse off the canvas: focus should keep the tooltip up.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(3000);
  console.log(`=== [${tag}] focus tooltip (cursor moved away):`, JSON.stringify(await page.evaluate(tooltipState)));
  await page.screenshot({ path: `${OUT}/task8fix5-${tag}-focus.png` });

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
