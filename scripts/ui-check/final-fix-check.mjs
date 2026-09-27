// Final fix wave verification (focus release, click radius, cursor/hover
// after camera motion, drift gate, reduced-motion render, hover ring).
// Usage: node scripts/ui-check/final-fix-check.mjs [section ...]
// Sections: gap, near, escape, hover, drift, reduced, ring (default: all).
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';
const OUT = 'scripts/ui-check/out';
const want = new Set(process.argv.slice(2));
const run = (name) => want.size === 0 || want.has(name);
const results = {};

async function openMap(browser, { reducedMotion = 'no-preference', path = '/' } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion,
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForFunction(() => window.__mapDebug?.getAlbumAt && window.__mapDebug?.getNearestScreenPoint?.());
  await page.waitForTimeout(1500);
  return { context, page };
}

/** Client position of the real album nearest the viewport centre. */
const centerAlbum = (page, x = 720, y = 450) =>
  page.evaluate(([px, py]) => window.__mapDebug.getAlbumAt(px, py).screen, [x, y]);

const focused = (page) => page.evaluate(() => window.__mapDebug.getFocusedAlbumPos() !== null);
const cam = (page) => page.evaluate(() => window.__mapDebug.getCameraState());

/** A point inside the cloud whose nearest album is 16..40 CSS px away. */
async function findGap(page) {
  return page.evaluate(() => {
    const d = window.__mapDebug;
    const c = document.querySelector('canvas').getBoundingClientRect();
    for (let y = c.top + c.height * 0.3; y < c.top + c.height * 0.7; y += 3) {
      for (let x = c.left + c.width * 0.35; x < c.left + c.width * 0.65; x += 3) {
        const hit = d.getAlbumAt(x, y);
        if (hit.distPx > 16 && hit.distPx < 40) return { x, y, ...hit };
      }
    }
    return null;
  });
}

async function main() {
  const browser = await chromium.launch();
  try {
    if (run('gap')) {
      const { context, page } = await openMap(browser);
      const gap = await findGap(page);
      const before = await cam(page);
      await page.mouse.click(gap.x, gap.y);
      await page.waitForTimeout(1200);
      results.gap = { gap, focusedAfterClick: await focused(page), camBefore: before, camAfter: await cam(page) };
      await context.close();
    }

    if (run('skip')) {
      // Skip link target exists, receives focus, and the next Tab leaves the map.
      results.skip = {};
      for (const path of ['/', '/music']) {
        const { context, page } = await openMap(browser, { path });
        await page.focus('.music-map-skip-link');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        const active = await page.evaluate(() => document.activeElement?.id);
        await page.keyboard.press('Tab');
        const next = await page.evaluate(() => {
          const el = document.activeElement;
          const map = document.getElementById('after-music-map').parentElement;
          return { tag: el?.tagName, text: (el?.textContent || '').trim().slice(0, 40), insideMap: map.contains(el) };
        });
        results.skip[path] = { targets: await page.evaluate(() => document.querySelectorAll('#after-music-map').length), activeAfterEnter: active, nextTab: next, title: await page.title() };
        await context.close();
      }
    }

    if (run('escsearch')) {
      // Escape inside the search input closes search but keeps focus; a
      // second Escape (input blurred) releases focus.
      const { context, page } = await openMap(browser);
      const pt = await centerAlbum(page);
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(900);
      await page.keyboard.press('/');
      await page.waitForTimeout(200);
      const inputFocused = await page.evaluate(() => document.activeElement?.tagName === 'INPUT');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const afterFirst = await focused(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      results.escsearch = { inputFocused, focusedAfterFirstEscape: afterFirst, focusedAfterSecondEscape: await focused(page) };
      await context.close();
    }

    if (run('edge')) {
      // A point 11..13 CSS px from its nearest disc: inside the 14px radius.
      const { context, page } = await openMap(browser);
      const pt = await page.evaluate(() => {
        const d = window.__mapDebug;
        for (let y = 300; y < 600; y += 2) {
          for (let x = 500; x < 940; x += 2) {
            const hit = d.getAlbumAt(x, y);
            if (hit.distPx > 11 && hit.distPx < 13) return { x, y, ...hit };
          }
        }
        return null;
      });
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(1200);
      const focusedPos = await page.evaluate(() => window.__mapDebug.getFocusedAlbumPos());
      results.edge = { point: pt, focusedAfterClick: focusedPos !== null, focusedPos };
      await context.close();
    }

    if (run('near') || run('escape')) {
      const { context, page } = await openMap(browser);
      const pt = await centerAlbum(page);
      // 10px off the disc centre: inside the 14px mouse radius.
      const p = { x: pt.x + 10, y: pt.y };
      const hit = await page.evaluate(({ x, y }) => window.__mapDebug.getAlbumAt(x, y), p);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(1200);
      results.near = { point: p, hit, focusedAfterClick: await focused(page), cam: await cam(page) };
      if (run('escape')) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        results.escape = { focusedAfterEscape: await focused(page), cam: await cam(page) };
      }
      await context.close();
    }

    if (run('hover')) {
      const { context, page } = await openMap(browser);
      const pt = await centerAlbum(page, 960, 360);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(300);
      const hoverBeforeClick = await page.evaluate(() => window.__mapDebug.getHoverIndex());
      await page.mouse.down();
      await page.mouse.up();
      // Glide is 550ms; wait well past it without moving the mouse.
      await page.waitForTimeout(1500);
      const after = await page.evaluate(({ x, y }) => ({
        hoverIndex: window.__mapDebug.getHoverIndex(),
        underMouse: window.__mapDebug.getAlbumAt(x, y),
        cursor: getComputedStyle(document.querySelector('canvas')).cursor,
        cam: window.__mapDebug.getCameraState(),
        
      }), pt);
      results.hover = {
        mouse: pt,
        hoverBeforeClick,
        ...after,
        agrees: after.hoverIndex === after.underMouse.index,
      };
      await context.close();
    }

    if (run('drift')) {
      const { context, page } = await openMap(browser);
      await page.mouse.move(720, 420);
      const c0 = await cam(page);
      await page.waitForTimeout(12000);
      const c1 = await cam(page);
      // Then leave the canvas: drift should be allowed again after the delay.
      await page.mouse.move(720, 895);
      await page.evaluate(() => {
        document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      });
      await page.waitForTimeout(12000);
      const c2 = await cam(page);
      results.drift = {
        restingCam0: c0,
        restingCam12s: c1,
        movedWhileResting: Math.hypot(c1.x - c0.x, c1.y - c0.y),
        afterLeave12s: c2,
        movedAfterLeave: Math.hypot(c2.x - c1.x, c2.y - c1.y),
      };
      await context.close();
    }

    if (run('reduced')) {
      const { context, page } = await openMap(browser, { reducedMotion: 'reduce' });
      const pt = await centerAlbum(page);
      const before = await page.evaluate(() => window.__mapDebug.getSpriteCssSize().effective);
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(600);
      const s = await page.evaluate(() => window.__mapDebug.getSpriteCssSize());
      results.reduced = { effectiveBefore: before, effectiveAfter: s.effective, uZoom: s.uZoom, cameraZoom: s.cameraZoom, focused: await focused(page) };
      await context.close();
    }

    if (run('ring')) {
      const { context, page } = await openMap(browser);
      // Zoom in a little so the hovered sprite is big enough to inspect.
      const pt0 = await centerAlbum(page);
      await page.mouse.move(pt0.x, pt0.y);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(800);
      const pt = await centerAlbum(page);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(1000);
      const hover = await page.evaluate(() => window.__mapDebug.getHoverIndex());
      const size = await page.evaluate(() => window.__mapDebug.getSpriteCssSize());
      const tag = process.env.RING_TAG || 'after';
      await page.screenshot({
        path: `${OUT}/final-ring-zoom-${tag}.png`,
        clip: { x: pt.x - 40, y: pt.y - 40, width: 80, height: 80 },
      });
      results.ring = { hover, spriteCss: size.effective, shot: `${OUT}/final-ring-zoom-${tag}.png` };
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
