import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:3111';

// Confirms Task 11's FocusController/CursorTracker changes didn't regress
// desktop mouse hover (tooltip) or click-to-focus.
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  // getNearestScreenPoint's fixed middle-index album can land under the
  // overlaid header (z-20, covering the top ~90px) rather than the canvas,
  // same class of fixture quirk as the mobile off-canvas case. Grid-search
  // the lower 80% of the viewport for a point that actually focuses.
  let pt = null;
  let focusedTitle = null;
  outer: for (const fx of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    for (const fy of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const candidate = { x: 1440 * fx, y: 900 * fy };
      await page.mouse.click(candidate.x, candidate.y);
      await page.waitForTimeout(300);
      const title = await page.evaluate(() => {
        const el = document.querySelector('[role="status"] b');
        return el ? el.textContent : null;
      });
      if (title) {
        pt = candidate;
        focusedTitle = title;
        break outer;
      }
    }
  }
  // Release focus, then test hover from a clean state.
  await page.mouse.click(1440 * 0.03, 900 * 0.03);
  await page.waitForTimeout(300);

  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(300); // past the 80ms hover-tooltip delay
  const tooltipOpacity = await page.evaluate(() => {
    const el = document.querySelector('[role="status"]');
    return el ? getComputedStyle(el).opacity : null;
  });
  const hoverTitle = await page.evaluate(() => {
    const el = document.querySelector('[role="status"] b');
    return el ? el.textContent : null;
  });

  console.log(
    JSON.stringify(
      { focusedTitleAfterClick: focusedTitle, tooltipOpacityOnHover: tooltipOpacity, hoverTitle },
      null,
      2,
    ),
  );
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
