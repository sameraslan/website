// Hover ring geometry check: hovers an isolated album after zooming in and
// writes a tight crop, so the full ink + paper ring can be inspected.
// Usage: RING_TAG=after node scripts/ui-check/final-ring-check.mjs
import { chromium } from 'playwright';

const tag = process.env.RING_TAG || 'after';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('http://localhost:3111/music');
  await page.waitForFunction(() => window.__mapDebug?.getAlbumAt);
  await page.waitForTimeout(1500);
  // The most isolated album on screen at overview: largest radius around it
  // (sampled on 16 rays) before another album becomes the nearest.
  const iso = await page.evaluate(() => {
    const d = window.__mapDebug;
    const c = document.querySelector('canvas').getBoundingClientRect();
    let best = null;
    for (let y = c.top + 60; y < c.bottom - 60; y += 3) {
      for (let x = c.left + 60; x < c.right - 60; x += 3) {
        const hit = d.getAlbumAt(x, y);
        if (hit.distPx > 3) continue;
        let minR = Infinity;
        for (let a = 0; a < 16; a++) {
          const t = (a / 16) * Math.PI * 2;
          for (const r of [6, 10, 14, 18, 24, 30]) {
            const h = d.getAlbumAt(hit.screen.x + Math.cos(t) * r, hit.screen.y + Math.sin(t) * r);
            if (h.nearest !== hit.nearest) { minR = Math.min(minR, r); break; }
          }
        }
        if (!best || minR > best.minR) best = { minR, ...hit.screen };
      }
    }
    return best;
  });
  if (!iso) throw new Error('no isolated album');
  await page.mouse.move(iso.x, iso.y);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  const pt = await page.evaluate(([x, y]) => window.__mapDebug.getAlbumAt(x, y).screen, [iso.x, iso.y]);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => ({
    hover: window.__mapDebug.getHoverIndex(),
    sprite: window.__mapDebug.getSpriteCssSize().effective,
  }));
  const half = Math.ceil(info.sprite * 1.25 * 0.5) + 24;
  const path = `scripts/ui-check/out/final-ring-iso-${tag}.png`;
  // screenshot clip is in page coordinates, so add the scroll offset.
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.screenshot({
    path,
    clip: { x: pt.x + scroll.x - half, y: pt.y + scroll.y - half, width: half * 2, height: half * 2 },
  });
  console.log(JSON.stringify({ iso, pt, scroll, ...info, path }));
} finally {
  await browser.close();
}
