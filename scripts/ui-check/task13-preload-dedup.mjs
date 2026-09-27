// Task 13 item 2: verify that navigating away from `/` and back does not
// duplicate the music-map data preload <link> tags or re-fire the fetches.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3111';

const browser = await chromium.launch();
const page = await browser.newPage();

const dataRequests = [];
page.on('request', (req) => {
  if (req.url().includes('/data/') && req.url().endsWith('.json')) {
    dataRequests.push(req.url());
  }
});

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.click('a[href="/about"]');
await page.waitForURL('**/about');
await page.waitForTimeout(300);
// Click the logo back to `/`.
await page.click('a[href="/"]');
await page.waitForURL(`${BASE}/`);
await page.waitForTimeout(500);

const preloadCount = await page.evaluate(
  () => document.querySelectorAll('link[rel="preload"][href*="/data/"]').length
);

console.log('preload link count:', preloadCount, '(expect 3)');
console.log('data fetch count for session:', dataRequests.length, '(expect 3)');
console.log('data requests:', dataRequests);

await browser.close();

if (preloadCount !== 3 || dataRequests.length !== 3) {
  console.error('FAIL: expected 3 preload links and 3 data fetches for the session');
  process.exit(1);
}
console.log('PASS');
