#!/usr/bin/env node
// Pixel diff of two same-size PNGs (in a headless page, via canvas).
// Usage: node scripts/ui-check/png-diff.mjs a.png b.png [threshold=24]
// Prints the count of differing pixels and their bounding box.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const [a, b, t = '24'] = process.argv.slice(2);
const toUrl = async (p) => `data:image/png;base64,${(await readFile(p)).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const r = await page.evaluate(
  async ([ua, ub, th]) => {
    const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    const w = ia.width, h = ia.height;
    const px = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]));
      if (d > th) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    return { size: [w, h, ib.width, ib.height], differing: n, box: n ? [x0, y0, x1, y1] : null };
  },
  [await toUrl(a), await toUrl(b), Number(t)]
);
console.log(JSON.stringify(r));
await browser.close();
