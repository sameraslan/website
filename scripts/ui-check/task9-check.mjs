import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3111';

async function checkDesktopRequests() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(2500);

  const jsonCounts = {};
  for (const name of ['positions.json', 'metadata.json', 'regions.json']) {
    jsonCounts[name] = requests.filter((u) => u.endsWith(`/data/${name}`)).length;
  }
  const atlasRequestsBeforeZoom = requests.filter((u) => /\/data\/atlas-\d+\.webp/.test(u));

  console.log('=== desktop `/` request counts (before zoom) ===');
  console.log(JSON.stringify(jsonCounts));
  console.log('atlas requests before zoom:', atlasRequestsBeforeZoom.length, atlasRequestsBeforeZoom);

  // Now wheel-zoom in past the 1.6 threshold and see which atlases load, and
  // whether atlas-0 arrives before the others.
  requests.length = 0;
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const px = rect.left + rect.width / 2;
    const py = rect.top + rect.height / 2;
    for (let i = 0; i < 40; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100,
        clientX: px,
        clientY: py,
        bubbles: true,
        cancelable: true,
      }));
      await new Promise((r) => setTimeout(r, 40));
    }
  });
  await page.waitForTimeout(2000);
  const zoomAfter = await page.evaluate(() =>
    window.__mapDebug?.getCameraState ? window.__mapDebug.getCameraState() : null,
  );
  const atlasRequestsAfterZoom = requests.filter((u) => /\/data\/atlas-\d+\.webp/.test(u));
  console.log('camera after zoom:', JSON.stringify(zoomAfter));
  console.log('atlas requests after zoom (in arrival order):', JSON.stringify(atlasRequestsAfterZoom));

  await browser.close();
}

async function checkMobileNoRequests() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const dataRequests = [];
  page.on('request', (req) => {
    if (/\/data\/.*\.json/.test(req.url())) dataRequests.push(req.url());
  });
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(2500);
  console.log('=== mobile `/` /data/*.json requests ===');
  console.log(JSON.stringify(dataRequests));
  await browser.close();
}

async function checkFast3gFirstDraw() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
  await context.route('**/*', (route) => route.continue());
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });

  const navStart = Date.now();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mapDebug && window.__mapDebug.firstDrawAt !== undefined, {
    timeout: 20000,
  });
  const firstDrawAt = await page.evaluate(() => window.__mapDebug.firstDrawAt);
  // firstDrawAt is a performance.now() timestamp inside the page; the page's
  // time origin corresponds to navigation start, so it is directly the
  // "time to first draw" number we want, modulo the small gap between our
  // navStart (Node clock) and the browser's actual navigation start.
  const elapsedMs = firstDrawAt;
  console.log('=== Fast 3G first-draw ===');
  console.log('firstDrawAt (ms since navigation):', elapsedMs.toFixed(1));
  console.log('(wall-clock since page.goto() call:', Date.now() - navStart, 'ms)');
  await browser.close();
}

async function main() {
  await checkDesktopRequests();
  await checkMobileNoRequests();
  await checkFast3gFirstDraw();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
