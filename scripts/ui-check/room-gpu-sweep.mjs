#!/usr/bin/env node
// GPU sweep of the /notes room, to catch parts of the room that the GPU path
// leaves blank or black, or a board that vanishes, while the camera moves.
// The room is one WebGL canvas under the DOM letter board; every state waits
// for .rs-root[data-room="ready"] (the canvas's first complete frame), with a
// 15 s fallback for builds that do not set it.
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
// The cases below use only real input, the page's own mode button (its label
// says which mode is on), the board's on-screen rect and screenshots, so they
// measure any implementation of the room the same way. "Board present" is the
// count of gold title pixels (near #f2c864) inside the board rect, as a ratio
// to the median of three settled at-rest shots; a vanished board scores ~0.
// A shot fails when the ratio is below 0.6 or flat dark (outside the board,
// when one is visible) is above 1.2%.
//
// --hover-board: reading mode; the mouse enters and leaves the board 12 times
//   (all four sides, 2 to 40 steps per move), shots ~80, 250 and 700 ms after
//   each enter and each leave.
// --fast: per mode, 40 quick moves between seeded random points (2-4 steps,
//   30-60 ms apart), a shot every 4th move mid-motion and one 2s after
//   (board ratio in reading mode only).
// --tour: starts the tour with the button, mouse parked bottom centre, a shot
//   every 2s for 46s (one 44s cycle); flat dark over the frame.
// --frames: requestAnimationFrame deltas during a 6s smooth mouse loop in
//   reading mode and 10s of the tour (median, p95, max, share over 25 ms).
//   Headless may not pace frames like a real display; informational only.
// --loadin: reloads and shoots 0.3, 0.8, 1.5, 2.2, 3.0 and 4.0s after the
//   navigation commits (--css is injected before first paint here).
//
// Usage:
//   node scripts/ui-check/room-gpu-sweep.mjs (--port <n> | --base <url>) [--viewports 800x600,1440x900,1506x812,1920x1080]
//     [--dpr 2] [--modes read,explore] [--grid full|corners] [--times 0,11,22,33]
//     [--css "<css injected in both>"] [--settle 1500] [--live] [--no-static]
//     [--hover-board] [--fast] [--tour] [--frames] [--loadin] [--seed 7]
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
    port: null,
    base: null,
    viewports: '800x600,1440x900,1506x812,1920x1080',
    dpr: 2,
    modes: 'read,explore',
    grid: 'full',
    times: '0,11,22,33',
    css: '',
    settle: 1500,
    live: false,
    hoverBoard: false,
    fast: false,
    tour: false,
    frames: false,
    loadin: false,
    seed: 7,
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
    else if (a === '--base') o.base = v().replace(/\/+$/, '');
    else if (a === '--viewports') o.viewports = v();
    else if (a === '--dpr') o.dpr = Number(v());
    else if (a === '--modes') o.modes = v();
    else if (a === '--grid') o.grid = v();
    else if (a === '--times') o.times = v();
    else if (a === '--css') o.css = v();
    else if (a === '--settle') o.settle = Number(v());
    else if (a === '--live') o.live = true;
    else if (a === '--hover-board') o.hoverBoard = true;
    else if (a === '--fast') o.fast = true;
    else if (a === '--tour') o.tour = true;
    else if (a === '--frames') o.frames = true;
    else if (a === '--loadin') o.loadin = true;
    else if (a === '--seed') o.seed = Number(v());
    else if (a === '--no-static') o.static = false;
    else if (a === '--budget') o.budget = Number(v());
    else if (a === '--screen') o.screen = v();
    else if (a === '--tag') o.tag = v();
    else if (a === '--save') o.save = v();
    else throw new Error(`Unknown flag ${a}`);
  }
  if (!o.base && !o.port) throw new Error('Give --port <n> (http://localhost:<n>) or --base <url>');
  o.base ??= `http://localhost:${o.port}`;
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
  // The canvas's first complete frame (all textures and pictures in), or 15 s.
  await page.waitForSelector('.rs-root[data-room="ready"]', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3200); // dolly in (2.8s), covers after hydration
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
    page.__url = `${o.base}/notes`;
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

// --- Implementation-agnostic helpers (real input, the mode button, the board rect, screenshots).

const BOARD_MIN = 0.6;
const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// Seeded PRNG (mulberry32), so --fast replays the same path.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The board's on-screen rect (CSS px), or null when no board is visible.
const visibleBoard = (page) =>
  page.evaluate(() => {
    for (const el of [document.querySelector('.gp-stage2 .gp-board'), ...document.querySelectorAll('.gp-board')]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight) return [r.left, r.top, r.right, r.bottom];
    }
    return null;
  });

const union = (a, b) => (a && b ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : a || b);
const devRect = (r, dpr) => r && [r[0] - 8, r[1] - 8, r[2] + 8, r[3] + 8].map((v) => v * dpr);
const poke = (page) => page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })));

// Gold title pixels (near #f2c864) inside the device-px rect r.
async function goldCount(buf, r) {
  if (!r) return 0;
  const { data, info } = await raw(buf);
  const { width: w, height: h } = info;
  const [x0, y0] = [Math.max(0, Math.floor(r[0])), Math.max(0, Math.floor(r[1]))];
  const [x1, y1] = [Math.min(w, Math.ceil(r[2])), Math.min(h, Math.ceil(r[3]))];
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (y * w + x) * 3;
      const [R, G, B] = [data[k], data[k + 1], data[k + 2]];
      if (R > 170 && G > 120 && B < 150 && R - B > 80 && R - G > 10 && R - G < 90) n++;
    }
  }
  return n;
}

// A fast screenshot: CDP capture with optimizeForSpeed (page.screenshot takes
// ~1s at 2880x1800, too slow for shots 80 ms after a move).
async function fastShot(page) {
  page.__cdp ??= await page.context().newCDPSession(page);
  const { data } = await page.__cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

// A screenshot with the board rect around it (union of before and after).
async function snap(page) {
  const r0 = await visibleBoard(page);
  const buf = await fastShot(page);
  const r1 = await visibleBoard(page);
  return { buf, rect: union(r0, r1) };
}

// Board ratio (when ref is given) and flat dark outside the board.
async function measure(shot, dpr, ref) {
  const ex = devRect(shot.rect, dpr);
  const dark = await flatDark(shot.buf, ex);
  const board = ref ? +((await goldCount(shot.buf, ex)) / ref).toFixed(2) : null;
  return { dark, board };
}

// Puts the page in a mode with a real click on its own button. With restart, a
// tour that is already running is stopped and started again from its beginning.
async function switchMode(page, mode, restart = false) {
  const reading = async () => /look around/i.test(await page.locator('.gp-ctl button').innerText());
  if (restart && mode === 'explore' && !(await reading())) {
    await page.click('.gp-ctl button');
    await page.waitForTimeout(800);
  }
  if ((mode === 'read') !== (await reading())) await page.click('.gp-ctl button');
  return Date.now();
}

// Gold count of the board at rest (median of three settled shots), mouse parked.
async function boardRef(page, w, h, dpr) {
  await page.mouse.move(w / 2, h - 4, { steps: 5 });
  await page.waitForTimeout(1500);
  const counts = [];
  for (let i = 0; i < 3; i++) {
    const s = await snap(page);
    counts.push(await goldCount(s.buf, devRect(s.rect, dpr)));
    await poke(page);
    await page.waitForTimeout(300);
  }
  return { ref: median(counts), counts };
}

function frameStats(d) {
  const s = [...d].sort((a, b) => a - b);
  if (!s.length) return { n: 0 };
  const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
  return { n: s.length, median: q(0.5), p95: q(0.95), max: +s[s.length - 1].toFixed(1), over25: +((100 * s.filter((v) => v > 25).length) / s.length).toFixed(1) };
}

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
        // The software page is the oracle for the static states only.
        const ps = o.static ? await (await sw.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: o.dpr })).newPage() : null;
        if (ps) {
          ps.__url = pg.__url;
          watch(ps, problems, 'sw');
        }
        await Promise.all([settlePage(pg, o.css), ps && settlePage(ps, o.css)]);

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

        if (o.hoverBoard) {
          // Reading mode: the real mouse enters and leaves the board 12 times.
          await switchMode(pg, 'read');
          const { ref, counts } = await boardRef(pg, w, h, o.dpr);
          const sides = ['left', 'top', 'right', 'bottom'];
          const steps = [3, 25, 2, 15, 4, 40, 2, 10, 3, 30, 4, 20];
          const rnd = rng(o.seed);
          const outside = (r, side) => {
            const cx = (r[0] + r[2]) / 2 + (rnd() - 0.5) * (r[2] - r[0]) * 0.6;
            const cy = (r[1] + r[3]) / 2 + (rnd() - 0.5) * (r[3] - r[1]) * 0.6;
            if (side === 'left') return [Math.max(4, r[0] - 80), cy];
            if (side === 'right') return [Math.min(w - 4, r[2] + 80), cy];
            if (side === 'top') return [cx, Math.max(4, r[1] - 60)];
            return [cx, Math.min(h - 4, r[3] + 60)];
          };
          const shots = [];
          let worst = null, worstKey = Infinity;
          // Shoots ~80, 250 and 700 ms after a move ends and scores the shots.
          const burst = async (label) => {
            const t0 = Date.now();
            const got = [];
            for (const at of [80, 250, 700]) {
              await wait(at - (Date.now() - t0));
              got.push([Date.now() - t0, await snap(pg)]);
            }
            for (const [ms, s] of got) {
              const m = await measure(s, o.dpr, ref);
              shots.push({ at: `${label} +${ms}ms`, ...m });
              const key = Math.min(m.board, 2) - m.dark;
              if (key < worstKey) { worstKey = key; worst = s.buf; }
            }
          };
          let r = await visibleBoard(pg);
          let [px, py] = outside(r, sides[0]);
          await pg.mouse.move(px, py, { steps: 8 });
          await pg.waitForTimeout(700);
          for (let i = 0; i < 12; i++) {
            r = (await visibleBoard(pg)) || r;
            const ix = r[0] + (0.25 + 0.5 * rnd()) * (r[2] - r[0]);
            const iy = r[1] + (0.25 + 0.5 * rnd()) * (r[3] - r[1]);
            await pg.mouse.move(ix, iy, { steps: steps[i] });
            await burst(`enter#${i} from ${sides[i % 4]} (${steps[i]} steps)`);
            r = (await visibleBoard(pg)) || r;
            [px, py] = outside(r, sides[(i + 1) % 4]);
            await pg.mouse.move(px, py, { steps: steps[(i + 5) % 12] });
            await burst(`leave#${i} to ${sides[(i + 1) % 4]} (${steps[(i + 5) % 12]} steps)`);
            await poke(pg);
          }
          const minBoard = Math.min(...shots.map((s) => s.board));
          const missing = shots.filter((s) => s.board < BOARD_MIN).length;
          const maxDark = Math.max(...shots.map((s) => s.dark));
          const fail = missing > 0 || maxDark > FLAT_DARK_MAX;
          const name = `hover-board ${vps}`;
          results.push({ name, ref, restCounts: counts, minBoard, missing, maxDark, shots, fail });
          console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(34)} board ratio min ${minBoard} (${missing} of ${shots.length} shots below ${BOARD_MIN}; rest gold px ${counts.join('/')})  flat dark max ${maxDark}%`);
          await save(name, [['worst', worst]], fail);
          await pg.mouse.move(w / 2, h - 4);
        }

        if (o.fast) {
          for (const mode of o.modes.split(',')) {
            await switchMode(pg, mode, true);
            const { ref } = mode === 'read' ? await boardRef(pg, w, h, o.dpr) : { ref: null };
            const rnd = rng(o.seed + (mode === 'read' ? 0 : 1));
            const pending = [];
            for (let i = 0; i < 40; i++) {
              const mv = pg.mouse.move(4 + rnd() * (w - 8), 4 + rnd() * (h - 8), { steps: 2 + Math.floor(rnd() * 3) });
              if (i % 4 === 3) pending.push(snap(pg)); // mid-motion, while the moves go on
              await mv;
              await wait(30 + rnd() * 30);
              if (mode === 'read' && i % 10 === 9) await poke(pg);
            }
            const shots = await Promise.all(pending);
            await pg.waitForTimeout(2000);
            const afterShot = await snap(pg);
            const ms = [];
            let worst = null, worstKey = Infinity;
            for (const s of shots) {
              const m = await measure(s, o.dpr, ref);
              ms.push(m);
              const key = Math.min(m.board ?? 1, 2) - m.dark;
              if (key < worstKey) { worstKey = key; worst = s.buf; }
            }
            const after = await measure(afterShot, o.dpr, ref);
            const all = [...ms, after];
            const maxDark = Math.max(...all.map((m) => m.dark));
            const boards = ref ? all.map((m) => m.board) : [];
            const minBoard = boards.length ? Math.min(...boards) : null;
            const missing = boards.filter((b) => b < BOARD_MIN).length;
            const fail = maxDark > FLAT_DARK_MAX || missing > 0;
            const name = `fast ${mode} ${vps}`;
            results.push({ name, ref, mid: ms, after, minBoard, missing, maxDark, fail });
            console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(34)} flat dark mid-motion [${ms.map((m) => m.dark).join(' ')}] after ${after.dark}${ref ? `  board ratio min ${minBoard} (${missing} of ${boards.length} below ${BOARD_MIN})` : ''}`);
            await save(name, [['worst-mid', worst], ['after', afterShot.buf]], fail);
          }
          await pg.mouse.move(w / 2, h - 4);
        }

        if (o.tour) {
          // The tour from its start, mouse parked on a bare spot, one shot every 2s.
          const t0 = await switchMode(pg, 'explore', true);
          await pg.mouse.move(w / 2, h - 4, { steps: 4 });
          const vals = [];
          let worst = null, worstV = -1;
          for (let k = 1; k <= 23; k++) {
            await wait(t0 + 2000 * k - Date.now());
            const s = await snap(pg);
            const { dark } = await measure(s, o.dpr, null);
            vals.push(dark);
            if (dark > worstV) { worstV = dark; worst = s.buf; }
          }
          const max = Math.max(...vals);
          const fail = max > FLAT_DARK_MAX;
          const name = `tour ${vps}`;
          results.push({ name, every2s: vals, max, fail });
          console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(34)} flat dark every 2s [${vals.join(' ')}] max ${max}`);
          await save(name, [['worst', worst]], fail);
        }

        if (o.frames) {
          const start = () =>
            pg.evaluate(() => {
              window.__ft = [];
              window.__ftOn = true;
              let last = performance.now();
              const tick = (t) => {
                window.__ft.push(t - last);
                last = t;
                if (window.__ftOn) requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            });
          const stop = () => pg.evaluate(() => { window.__ftOn = false; return window.__ft.slice(1); });
          // (a) Reading mode, a smooth 6s mouse loop (two laps of an ellipse).
          await switchMode(pg, 'read');
          await pg.mouse.move(w / 2 + 0.42 * w, h / 2, { steps: 10 });
          await pg.waitForTimeout(1000);
          await start();
          const t0 = Date.now();
          let lastPoke = t0;
          while (Date.now() - t0 < 6000) {
            const th = (2 * Math.PI * (Date.now() - t0)) / 3000;
            await pg.mouse.move(w / 2 + 0.42 * w * Math.cos(th), h / 2 + 0.4 * h * Math.sin(th));
            await wait(16);
            if (Date.now() - lastPoke > 2000) { await poke(pg); lastPoke = Date.now(); }
          }
          const a = frameStats(await stop());
          // (b) 10s of the tour, mouse parked.
          await switchMode(pg, 'explore', true);
          await pg.mouse.move(w / 2, h - 4, { steps: 4 });
          await start();
          await pg.waitForTimeout(10000);
          const b = frameStats(await stop());
          const fmt = (s) => `n ${s.n} median ${s.median} p95 ${s.p95} max ${s.max} ms, ${s.over25}% > 25ms`;
          const name = `frames ${vps}`;
          results.push({ name, sweep: a, tour: b, fail: false });
          console.log(`info ${name.padEnd(34)} sweep: ${fmt(a)} | tour: ${fmt(b)}`);
        }

        if (o.loadin) {
          // A fresh load; shots during the load-in, --css in place before first paint.
          if (o.css) {
            await pg.addInitScript((css) => {
              const add = () => {
                if (!document.head) return false;
                const st = document.createElement('style');
                st.textContent = css;
                document.head.append(st);
                return true;
              };
              if (!add()) document.addEventListener('readystatechange', function f() { if (add()) document.removeEventListener('readystatechange', f); });
            }, o.css);
          }
          await pg.mouse.move(w / 2, h - 4);
          await pg.goto(pg.__url, { waitUntil: 'commit' });
          const t0 = Date.now();
          const vals = [];
          let worst = null, worstV = -1;
          for (const at of [300, 800, 1500, 2200, 3000, 4000]) {
            await wait(t0 + at - Date.now());
            const s = await snap(pg);
            const { dark } = await measure(s, o.dpr, null);
            vals.push(`${Date.now() - t0}ms:${dark}`);
            if (dark > worstV) { worstV = dark; worst = s.buf; }
          }
          const fail = worstV > FLAT_DARK_MAX;
          const name = `loadin ${vps}`;
          results.push({ name, shots: vals, max: worstV, fail });
          console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(34)} flat dark [${vals.join(' ')}]`);
          await save(name, [['worst', worst]], fail);
        }
        await ps?.context().close();
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
