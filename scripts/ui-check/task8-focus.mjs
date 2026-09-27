import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

async function main() {
  const browser = await chromium.launch();
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
    await new Promise((r) => setTimeout(r, 800));
    return { point, focused: window.__mapDebug.getFocusedAlbumPos() };
  });
  console.log(JSON.stringify(result));
  await page.screenshot({ path: 'scripts/ui-check/out/task8-focused-zoomedin.png' });

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
