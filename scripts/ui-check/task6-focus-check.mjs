import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

async function main() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(4000);

    const pt = await page.evaluate(() => window.__mapDebug.getNearestScreenPoint());
    if (!pt) throw new Error('no nearest point');

    // Click to focus. FocusController's click handler uses its own
    // HIT_RADIUS (world units), independent of the hover radius, so a
    // direct click at the album's exact projected point should land on it.
    await page.mouse.click(pt.x, pt.y);

    // Tooltip should appear immediately on focus, no 80ms delay.
    const immediate = await page.evaluate(() => {
      const el = document.querySelector('[role="status"]');
      return el ? { opacity: getComputedStyle(el).opacity, text: el.textContent } : null;
    });
    console.log('immediately after click:', JSON.stringify(immediate));

    // Sample the tooltip's bounding rect twice, 200ms apart, during the
    // 550ms fly-to glide: it should be moving (rect differs) since
    // TooltipDriver re-projects every rendered frame.
    const rect1 = await page.evaluate(() => {
      const el = document.querySelector('[role="status"]');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    await page.waitForTimeout(200);
    const rect2 = await page.evaluate(() => {
      const el = document.querySelector('[role="status"]');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });

    console.log('rect@t0:', JSON.stringify(rect1));
    console.log('rect@t200ms:', JSON.stringify(rect2));
    console.log('moved during glide:', rect1.x !== rect2.x || rect1.y !== rect2.y);

    // After the 550ms glide settles, tooltip should still show, stationary.
    await page.waitForTimeout(600);
    const settled = await page.evaluate(() => {
      const el = document.querySelector('[role="status"]');
      return { opacity: getComputedStyle(el).opacity, text: el.textContent };
    });
    console.log('settled:', JSON.stringify(settled));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
