#!/usr/bin/env node
// Room check harness: viewport screenshot of a local page (default /notes) with
// optional interaction first, plus console errors, warnings and failed requests.
//
// Usage:
//   node scripts/ui-check/room-shot.mjs [--port 3477] [--path /notes]
//     [--browser chromium|webkit|firefox] [--viewport 1440x900] [--wait ms]
//     [--reduced-motion] [--name shot] [--mouse x,y] [--hover "<css>"]
//     [--click "<css>"] [--key Escape] [--eval "<js>"] [--steps '<json>']
//     [--no-shot] [--no-hydrate] [--device "<Playwright device name>"] [--touch]
//     [--full] [--requests "<url substring>"]
//
// --device uses a Playwright device profile (viewport, touch, mobile, user agent);
// --viewport still overrides its size. --touch emulates a touch screen with a
// coarse pointer (hasTouch + isMobile in Chromium and WebKit; Firefox only
// gets hasTouch, so its pointer stays fine). --full takes full-page screenshots.
// --requests prints every request whose URL contains the substring, in order.
// Steps also accept {"tap": "<css>"} (touch tap), {"scrollBy": [x, y]} and
// {"viewport": [w, h]} (resize the page).
//
// --no-hydrate blocks the Next.js JS chunks, so the page stays as the server
// sent it (inline scripts still run): checks what the first paint looks like.
//
// Steps run in this order: load, wait, mouse, hover, click, key, short settle,
// eval (printed as JSON), steps, screenshot (viewport only; the page is fixed-size).
//
// --steps is a JSON array (or @path to a JSON file) run in order, each item one of:
//   {"wait": ms} {"mouse": [x, y]} {"hover": "<css>"} {"click": "<css>"}
//   {"clickAt": [x, y]} {"clickWhere": "<js returning [x, y]>"} {"focus": "<css>"} {"key": "Escape"}
//   {"eval": "<js>", "label": "name"} {"shot": "name"}
// so one page load can be checked at several moments (eval results print as
// "label: json", shots save to out/<name>.png).

import { chromium, devices, firefox, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');

function parseArgs(argv) {
  const o = {
    port: 3477,
    path: '/notes',
    browser: 'chromium',
    viewport: '1440x900',
    wait: 3500,
    reducedMotion: false,
    name: 'room',
    click: null,
    hover: null,
    key: null,
    mouse: null,
    evalJs: null,
    settle: 900,
    steps: null,
    shot: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--port') o.port = Number(next());
    else if (a === '--path') o.path = next();
    else if (a === '--browser') o.browser = next();
    else if (a === '--viewport') o.viewport = o.viewportSet = next();
    else if (a === '--wait') o.wait = Number(next());
    else if (a === '--settle') o.settle = Number(next());
    else if (a === '--reduced-motion') o.reducedMotion = true;
    else if (a === '--name') o.name = next();
    else if (a === '--click') o.click = next();
    else if (a === '--hover') o.hover = next();
    else if (a === '--key') o.key = next();
    else if (a === '--mouse') o.mouse = next();
    else if (a === '--eval') o.evalJs = next();
    else if (a === '--steps') {
      const v = next();
      o.steps = JSON.parse(v.startsWith('@') ? readFileSync(v.slice(1), 'utf8') : v);
    }
    else if (a === '--no-shot') o.shot = false;
    else if (a === '--no-hydrate') o.noHydrate = true;
    else if (a === '--device') o.device = next();
    else if (a === '--touch') o.touch = true;
    else if (a === '--full') o.full = true;
    else if (a === '--requests') o.requests = next();
    else throw new Error(`Unknown flag ${a}`);
  }
  return o;
}

// Full-page shots grow the viewport to the page height instead of using
// Playwright's fullPage, which in Chromium drops touch emulation for the
// capture (the page then flips to the desktop room mid-shot).
async function shoot(page, file, full) {
  if (!full) return page.screenshot({ path: file, fullPage: false });
  const vp = page.viewportSize();
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  if (h > vp.height) await page.setViewportSize({ width: vp.width, height: h });
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: false });
  if (h > vp.height) await page.setViewportSize(vp);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const [w, h] = o.viewport.split('x').map(Number);
  const engine = { chromium, webkit, firefox }[o.browser];
  if (!engine) throw new Error(`Unknown browser ${o.browser}`);

  const browser = await engine.launch();
  const problems = [];
  try {
    let profile = {};
    if (o.device) {
      profile = { ...devices[o.device] };
      if (!devices[o.device]) throw new Error(`Unknown device ${o.device}`);
      if (o.browser === 'firefox') delete profile.isMobile;
    }
    if (o.touch) profile = { ...profile, hasTouch: true, ...(o.browser === 'firefox' ? {} : { isMobile: true }) };
    if (!o.device || o.viewportSet) profile.viewport = { width: w, height: h };
    const context = await browser.newContext({
      ...profile,
      reducedMotion: o.reducedMotion ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    if (o.noHydrate) await page.route(/\/_next\/static\/.*\.js/, (route) => route.abort());
    page.on('console', (msg) => {
      const t = msg.type();
      if (t === 'error' || t === 'warning') problems.push(`[console.${t}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
    page.on('requestfailed', (req) =>
      !(o.noHydrate && /\/_next\/static\//.test(req.url())) && problems.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`)
    );
    const requested = [];
    if (o.requests) page.on('request', (req) => req.url().includes(o.requests) && requested.push(req.url()));
    page.on('response', (res) => {
      if (res.status() >= 400) problems.push(`[http ${res.status()}] ${res.url()}`);
    });

    await page.goto(`http://localhost:${o.port}${o.path}`, { waitUntil: 'load' });
    await page.waitForTimeout(o.wait);

    if (o.mouse) {
      const [mx, my] = o.mouse.split(',').map(Number);
      await page.mouse.move(mx, my, { steps: 5 });
    }
    // Pointer parallax moves the room under the pointer, so aim, let the
    // camera settle, then aim again at where the element now is.
    const hoverOn = async (sel) => {
      for (let pass = 0; pass < 3; pass++) {
        const box = await page.locator(sel).first().boundingBox();
        if (!box) throw new Error(`hover: no box for ${sel}`);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
        await page.waitForTimeout(800);
      }
    };
    if (o.hover) await hoverOn(o.hover);
    if (o.click) await page.click(o.click, { force: true });
    if (o.key) await page.keyboard.press(o.key);
    if (o.mouse || o.hover || o.click || o.key) await page.waitForTimeout(o.settle);

    if (o.evalJs !== null) {
      const result = await page.evaluate(o.evalJs);
      process.stdout.write(JSON.stringify(result, null, 1) + '\n');
    }

    await mkdir(OUT_DIR, { recursive: true });
    for (const st of o.steps ?? []) {
      if ('wait' in st) await page.waitForTimeout(st.wait);
      else if ('mouse' in st) await page.mouse.move(st.mouse[0], st.mouse[1], { steps: 5 });
      else if ('hover' in st) await hoverOn(st.hover);
      else if ('click' in st) await page.click(st.click, { force: true });
      else if ('clickAt' in st) await page.mouse.click(st.clickAt[0], st.clickAt[1]);
      else if ('clickWhere' in st) {
        // JS that returns [x, y]; the mouse clicks there.
        const pt = await page.evaluate(st.clickWhere);
        if (!pt) throw new Error(`clickWhere found no point: ${st.clickWhere}`);
        process.stdout.write(`clickWhere: ${JSON.stringify(pt)}\n`);
        await page.mouse.click(pt[0], pt[1]);
      }
      else if ('focus' in st) await page.focus(st.focus);
      else if ('tap' in st) await page.tap(st.tap);
      else if ('scrollBy' in st) await page.evaluate(([x, y]) => window.scrollBy(x, y), st.scrollBy);
      else if ('viewport' in st) await page.setViewportSize({ width: st.viewport[0], height: st.viewport[1] });
      else if ('key' in st) await page.keyboard.press(st.key);
      else if ('eval' in st) {
        const r = await page.evaluate(st.eval);
        process.stdout.write(`${st.label ?? 'eval'}: ${JSON.stringify(r)}\n`);
      } else if ('shot' in st) {
        const p = path.join(OUT_DIR, `${st.shot}.png`);
        await shoot(page, p, o.full);
        process.stdout.write(p + '\n');
      } else throw new Error(`Unknown step ${JSON.stringify(st)}`);
    }

    if (o.shot) {
      const outPath = path.join(OUT_DIR, `${o.name}.png`);
      await shoot(page, outPath, o.full);
      process.stdout.write(outPath + '\n');
    }
    if (o.requests) process.stdout.write(`--- ${requested.length} request(s) matching ${o.requests}:\n${requested.join('\n')}\n`);
  } finally {
    await browser.close();
  }
  if (problems.length) {
    process.stdout.write(`--- ${problems.length} console/network problem(s):\n${problems.join('\n')}\n`);
  } else {
    process.stdout.write('--- console clean, no failed requests\n');
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
