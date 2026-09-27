import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

// Verifies Task 11's touch interactions on the mobile home map: tap-to-focus
// (sheet shows a title), tap-on-empty releases focus, and two-finger pinch
// (via CDP Input.dispatchTouchEvent) increases zoom without changing focus.
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(3000);

  const results = {};

  function sheetState() {
    const spans = [...document.querySelectorAll('span')];
    const hint = spans.find((s) => s.textContent?.toLowerCase().includes('tap a point'));
    const title = spans.find(
      (s) => s.className.includes('font-display') && s.className.includes('text-[18px]'),
    );
    return { hintPresent: !!hint, titleText: title ? title.textContent : null };
  }

  // 1. Sheet shows "tap a point" initially.
  results.initial = await page.evaluate(sheetState);

  // 2. Tap a dense point -> sheet shows a title. getNearestScreenPoint
  // projects a real album's world position using the *desktop* middle-index
  // convention, which on the narrower mobile frustum can land off-canvas
  // (confirmed separately: a touchscreen.tap at a negative/out-of-viewport
  // coordinate is silently dropped, producing no pointer events at all —
  // real touch hardware can't produce negative coordinates either, so this
  // is a fixture limitation, not a Task 11 bug). Grid-search a handful of
  // on-canvas points instead and use whichever one actually lands on an
  // album (the cloud is dense enough that several will).
  const canvasBox = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  const width = canvasBox.right - canvasBox.left;
  const height = canvasBox.bottom - canvasBox.top;
  let pt = null;
  outer: for (const fx of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    for (const fy of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const candidate = { x: canvasBox.left + fx * width, y: canvasBox.top + fy * height };
      await page.touchscreen.tap(candidate.x, candidate.y);
      await page.waitForTimeout(200);
      const state = await page.evaluate(sheetState);
      if (state.titleText) {
        pt = candidate;
        break outer;
      }
    }
  }
  if (!pt) throw new Error('grid search found no album under any candidate point');
  results.afterTap = await page.evaluate(sheetState);
  await page.waitForTimeout(1500); // let the fly-to-focus glide settle

  // 3. Two-finger pinch via CDP dispatchTouchEvent: zoom should increase,
  // and the pinch itself must not change focus (still the same title, not
  // reverted to the hint) — spec/Task 11 item 2's "a pinch must not trigger
  // focus".
  const before = await page.evaluate(() => window.__mapDebug.getCameraState());
  const cdp = await context.newCDPSession(page);
  const cx = (canvasBox.left + canvasBox.right) / 2;
  const cy = (canvasBox.top + canvasBox.bottom) / 2;
  function touchPoints(spread) {
    return [
      { x: cx - spread, y: cy, id: 1 },
      { x: cx + spread, y: cy, id: 2 },
    ];
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoints(20) });
  for (const spread of [40, 80, 120, 160]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoints(spread) });
    await page.waitForTimeout(50);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  const afterZoomIn = await page.evaluate(() => window.__mapDebug.getCameraState());
  results.pinchZoomIn = {
    before: before.zoom,
    after: afterZoomIn.zoom,
    increased: afterZoomIn.zoom > before.zoom,
  };
  results.afterPinchZoomIn = await page.evaluate(sheetState);

  // 4. Pinch back out (fingers moving together) toward the overview zoom,
  // which also puts more of the cloud's sparse periphery on screen, then
  // grid-search for a point where NOTHING is under the finger (title stays
  // absent / hint reappears) -> confirms tap-on-empty still releases focus
  // even after zoom/pan have moved considerably (not just at first load).
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoints(160) });
  for (const spread of [120, 80, 40, 20]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoints(spread) });
    await page.waitForTimeout(50);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  const afterZoomOut = await page.evaluate(() => window.__mapDebug.getCameraState());
  results.pinchZoomOut = { before: afterZoomIn.zoom, after: afterZoomOut.zoom };
  results.afterPinchZoomOut = await page.evaluate(sheetState);

  let releasedAt = null;
  outerEmpty: for (const fx of [0.03, 0.15, 0.85, 0.97]) {
    for (const fy of [0.03, 0.15, 0.85, 0.97]) {
      const candidate = { x: canvasBox.left + fx * width, y: canvasBox.top + fy * height };
      await page.touchscreen.tap(candidate.x, candidate.y);
      await page.waitForTimeout(150);
      const state = await page.evaluate(sheetState);
      if (state.hintPresent) {
        releasedAt = candidate;
        break outerEmpty;
      }
      // Landed on a (different) album instead of empty space: that's still
      // a valid tap-to-focus, just try the next corner for a true empty
      // read before concluding.
    }
  }
  results.releasedAt = releasedAt;
  results.afterEmptyTap = await page.evaluate(sheetState);

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
