#!/usr/bin/env node
// GPU sweep of the /notes room, to catch planes that Chrome's GPU compositor
// leaves unrasterized (blank or black patches) or drops.
//
// Browsers:
//   gpu: Playwright's full Chromium in new headless mode (channel 'chromium'),
//        which composites and rasterizes on the GPU (ANGLE Metal on a Mac;
//        chrome://gpu reads "Compositing: Hardware accelerated"; printed at start).
//        It runs at a real device scale factor (--force-device-scale-factor, not
//        Playwright's emulation, which leaves the compositor at 1x) and with a
//        Retina laptop screen (--screen-info), because Chrome sizes its GPU tile
//        budget from the screen (852 MB for 3456x2234; 512 MB for headless's
//        default screen). --budget overrides it.
//   sw:  the default chromium-headless-shell, which composites in software. It
//        draws the same state, as an oracle for the static states.
//
// Static states: mode set through the page's own button, --mx/--my set on the
// root, transitions finished, the tour paused at a fixed time in both stage
// layers, a settle, then a shot from each browser. Reported: the share of 8x8
// device-pixel blocks that differ from the software shot (most pixels off by
// > 48; the two renderers differ by 1.5-4.5% on a correct room, from depth
// sorting at plane edges) and the share of flat near-black blocks outside the
// board in the GPU shot (an unrasterized tile is flat; the room's textures and
// the film grain never are; ~0.3-0.7% on a correct room, from black frames and
// covers). A state fails when flat dark > 1.2% or the diff > 6%.
//
// --live: the real-mouse case, per viewport and mode: the mouse sweeps the
// window corner to corner (tour running in explore) with 10 shots mid-motion,
// then one 2s after it stops. Fails when any shot has flat dark > 1.2%.
//
// Usage:
//   node scripts/ui-check/room-gpu-sweep.mjs [--port 3477] [--viewports 800x600,1440x900,1506x812,1920x1080]
//     [--dpr 2] [--modes read,explore] [--grid full|corners] [--times 0,11,22,33]
//     [--css "<css injected in both>"] [--settle 1500] [--live] [--no-static]
//     [--budget <MB>] [--screen 3456x2234] [--tag name] [--save fail|all|none]
// Prints one line per state and a summary; shots go to out/gpu-sweep/<tag>/.
// Exit code 1 when any state fails.

import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const o = {
    port: 3477,
    viewports: '800x600,1440x900,1506x812,1920x1080',
    dpr: 2,
    modes: 'read,explore',
    grid: 'full',
    times: '0,11,22,33',
    css: '',
    settle: 1500,
    live: false,
    static: true,
    budget: null,
    screen: '3456x2234',
    tag: 'run',
    save: 'fail',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--port') o.port = Number(v());
    else if (a === '--viewports') o.viewports = v();
    else if (a === '--dpr') o.dpr = Number(v());
    else if (a === '--modes') o.modes = v();
    else if (a === '--grid') o.grid = v();
    else if (a === '--times') o.times = v();
    else if (a === '--css') o.css = v();
    else if (a === '--settle') o.settle = Number(v());
    else if (a === '--live') o.live = true;
    else if (a === '--no-static') o.static = false;
    else if (a === '--budget') o.budget = Number(v());
    else if (a === '--screen') o.screen = v();
    else if (a === '--tag') o.tag = v();
    else if (a === '--save') o.save = v();
    else throw new Error(`Unknown flag ${a}`);
  }
  return o;
}

const GRID_FULL = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => [x, y]));
const GRID_CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]];
const FLAT_DARK_MAX = 1.2;
const DIFF_MAX = 6;

const raw = (buf) => sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });

// Share of 8x8 blocks where most pixels differ by more than 48.
async function diff(bufA, bufB) {
  const [a, b] = await Promise.all([raw(bufA), raw(bufB)]);
  const { width: w, height: h } = a.info;
  if (w !== b.info.width || h !== b.info.height) return { pct: 100, box: null, error: 'size mismatch' };
  const B = 8;
  let bad = 0, total = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let by = 0; by + B <= h; by += B) {
    for (let bx = 0; bx + B <= w; bx += B) {
      total++;
      let n = 0;
      for (let y = by; y < by + B; y++) {
        for (let x = bx; x < bx + B; x++) {
          const k = (y * w + x) * 3;
          if (Math.max(Math.abs(a.data[k] - b.data[k]), Math.abs(a.data[k + 1] - b.data[k + 1]), Math.abs(a.data[k + 2] - b.data[k + 2])) > 48) n++;
        }
      }
      if (n > (B * B) / 2) {
        bad++;
        x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx + B); y1 = Math.max(y1, by + B);
      }
    }
  }
  return { pct: +((100 * bad) / total).toFixed(2), box: bad ? [x0, y0, x1, y1] : null };
}

// Share of flat near-black 8x8 blocks outside the rect ex (device px).
async function flatDark(buf, ex) {
  const { data, info } = await raw(buf);
  const { width: w, height: h } = info;
  const B = 8;
  let n = 0, total = 0;
  for (let by = 0; by + B <= h; by += B) {
    for (let bx = 0; bx + B <= w; bx += B) {
      if (ex && bx + B > ex[0] && bx < ex[2] && by + B > ex[1] && by < ex[3]) continue;
      total++;
      let lo = 765, hi = 0;
      for (let y = by; y < by + B; y++) {
        for (let x = bx; x < bx + B; x++) {
          const k = (y * w + x) * 3;
          const v = data[k] + data[k + 1] + data[k + 2];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      if (hi < 100 && hi - lo < 6) n++;
    }
  }
  return +((100 * n) / total).toFixed(2);
}

async function settlePage(page, css) {
  await page.goto(page.__url, { waitUntil: 'load' });
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(3200); // dolly in (2.8s), covers after hydration
  // Room images only (the flat page's lazy strip images never load while hidden).
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.rs-stage img')];
    const all = Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }))))
      .then(() => Promise.all(imgs.map((i) => i.decode().catch(() => null))));
    await Promise.race([all, new Promise((r) => setTimeout(r, 15000))]);
  });
}

function watch(page, problems, label) {
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`[${label} console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[${label} pageerror] ${e.message}`));
}

// The GPU page, at a real device scale factor in a window whose inner size is the viewport.
async function openGpu(o, w, h, problems) {
  let chromeH = 87;
  for (let attempt = 0; attempt < 2; attempt++) {
    const args = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', `--force-device-scale-factor=${o.dpr}`, `--window-size=${w},${h + chromeH}`];
    if (o.screen) args.push(`--screen-info={${o.screen} devicePixelRatio=${o.dpr}}`);
    if (o.budget) args.push(`--force-gpu-mem-available-mb=${o.budget}`);
    const browser = await chromium.launch({ channel: 'chromium', args });
    const page = await (await browser.newContext({ viewport: null })).newPage();
    page.__url = `http://localhost:${o.port}/notes`;
    await page.goto('about:blank');
    const [iw, ih, dpr] = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
    if (iw === w && ih === h && dpr === o.dpr) {
      watch(page, problems, 'gpu');
      return { browser, page };
    }
    await browser.close();
    if (iw !== w) throw new Error(`gpu window is ${iw} wide, wanted ${w}`);
    chromeH += h - ih;
  }
  throw new Error('could not size the gpu window');
}

// Puts the page in one state. Mode goes through the page's own button so React
// owns it; a keydown marks activity so the idle switch never fires mid-sweep.
async function setState(page, { mode, mx, my, t }) {
  await page.evaluate(
    async ({ mode, mx, my, t }) => {
      const root = document.querySelector('.rs-root');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      if ((mode === 'explore') !== root.classList.contains('gn-explore')) document.querySelector('.gp-ctl button').click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      root.style.setProperty('--mx', String(mx));
      root.style.setProperty('--my', String(my));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const a of document.getAnimations()) {
        if (/^gn-tour/.test(a.animationName || '')) {
          a.pause();
          a.currentTime = t * 1000;
        } else {
          try { a.finish(); } catch { /* infinite */ }
        }
      }
    },
    { mode, mx, my, t }
  );
}

const boardRect = (page) =>
  page.evaluate(() => {
    const r = document.querySelector('.gp-stage2 .gp-board').getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom];
  });

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, 'out', 'gpu-sweep', o.tag);
  await mkdir(outDir, { recursive: true });
  const problems = [];
  const results = [];
  const sw = await chromium.launch();
  const save = async (name, files, fail) => {
    if (o.save === 'all' || (o.save === 'fail' && fail)) for (const [suffix, buf] of files) await writeFile(path.join(outDir, `${name.replace(/[ ,]/g, '_')}-${suffix}.png`), buf);
  };
  let proved = false;
  try {
    for (const vps of o.viewports.split(',')) {
      const [w, h] = vps.split('x').map(Number);
      const { browser: gpu, page: pg } = await openGpu(o, w, h, problems);
      try {
        if (!proved) {
          // Proof of hardware compositing in the GPU browser.
          const p = await gpu.newPage();
          await p.goto('chrome://gpu');
          await p.waitForTimeout(1000);
          const txt = await p.evaluate(() => document.querySelector('info-view')?.shadowRoot?.textContent ?? '');
          console.log(`gpu browser: Compositing: ${(txt.match(/Compositing:\s*([A-Za-z ]+?)(?=\s*\*|\s{2}|$)/) || [])[1]} | GL_RENDERER ${(txt.match(/GL_RENDERER\s*([^\n]*?)GL_VERSION/) || [])[1]}`);
          await p.close();
          proved = true;
        }
        const ps = await (await sw.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr })).newPage();
        ps.__url = pg.__url;
        watch(ps, problems, 'sw');
        await Promise.all([settlePage(pg, o.css), settlePage(ps, o.css)]);

        if (o.static) {
          const grid = o.grid === 'corners' ? GRID_CORNERS : GRID_FULL;
          for (const mode of o.modes.split(',')) {
            const times = mode === 'explore' ? o.times.split(',').map(Number) : [0];
            for (const t of times) {
              for (const [mx, my] of grid) {
                const st = { mode, mx, my, t };
                const name = `${mode} ${vps} ${mx},${my} ${t}`;
                await Promise.all([setState(pg, st), setState(ps, st)]);
                await pg.waitForTimeout(o.settle);
                const ex = (await boardRect(pg)).map((v, i) => (v + (i < 2 ? -8 : 8)) * o.dpr);
                const [bg, bs] = await Promise.all([pg.screenshot(), ps.screenshot()]);
                const d = await diff(bg, bs);
                const dark = await flatDark(bg, ex);
                const fail = dark > FLAT_DARK_MAX || d.pct > DIFF_MAX;
                results.push({ name, diff: d.pct, dark, box: d.box, fail });
                console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(34)} flat dark ${String(dark).padStart(5)}%  diff vs sw ${String(d.pct).padStart(5)}%`);
                await save(name, [['gpu', bg], ['sw', bs]], fail);
              }
            }
          }
        }

        if (o.live) {
          for (const mode of o.modes.split(',')) {
            // Real mouse: the pointer sweeps the window, tour running in explore.
            await pg.evaluate((mode) => {
              const root = document.querySelector('.rs-root');
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
              if ((mode === 'explore') !== root.classList.contains('gn-explore')) document.querySelector('.gp-ctl button').click();
              for (const a of document.getAnimations()) if (/^gn-tour/.test(a.animationName || '')) { a.currentTime = 0; a.play(); }
            }, mode);
            await pg.waitForTimeout(400);
            const pts = [[0.02, 0.02], [0.98, 0.05], [0.95, 0.95], [0.05, 0.9], [0.5, 0.5], [0.02, 0.5], [0.98, 0.5], [0.5, 0.02], [0.5, 0.98], [0.02, 0.02]];
            const vals = [];
            let worst = null, worstV = -1;
            for (const [x, y] of pts) {
              const mv = pg.mouse.move(x * w, y * h, { steps: 30 });
              await pg.waitForTimeout(250);
              const r0 = await boardRect(pg);
              const shot = await pg.screenshot();
              const r1 = await boardRect(pg);
              await mv;
              const ex = [Math.min(r0[0], r1[0]) - 8, Math.min(r0[1], r1[1]) - 8, Math.max(r0[2], r1[2]) + 8, Math.max(r0[3], r1[3]) + 8].map((v) => v * o.dpr);
              const v = await flatDark(shot, ex);
              vals.push(v);
              if (v > worstV) { worstV = v; worst = shot; }
              // Keep the idle switch from changing the mode in read sweeps.
              await pg.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })));
            }
            await pg.waitForTimeout(2000);
            const after = await pg.screenshot();
            const afterDark = await flatDark(after, (await boardRect(pg)).map((v, i) => (v + (i < 2 ? -8 : 8)) * o.dpr));
            const max = Math.max(...vals, afterDark);
            const fail = max > FLAT_DARK_MAX;
            const name = `live ${mode} ${vps}`;
            results.push({ name, mid: vals, after: afterDark, fail });
            console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(34)} flat dark mid-motion [${vals.join(' ')}] after ${afterDark}`);
            await save(name, [['worst-mid', worst], ['after', after]], fail);
            await pg.mouse.move(w / 2, h - 2);
          }
        }
        await ps.context().close();
      } finally {
        await gpu.close();
      }
    }
  } finally {
    await sw.close();
  }
  const failed = results.filter((r) => r.fail);
  await writeFile(path.join(outDir, 'results.json'), JSON.stringify(results, null, 1));
  console.log(`--- ${failed.length} of ${results.length} states fail (${o.tag})`);
  const uniq = [...new Set(problems)];
  console.log(uniq.length ? `--- ${uniq.length} console problem(s):\n${uniq.join('\n')}` : '--- console clean');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
