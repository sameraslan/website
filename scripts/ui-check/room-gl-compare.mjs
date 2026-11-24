#!/usr/bin/env node
// Side-by-side check of the WebGL room against the DOM room.
// Screenshots /notes (the DOM room) and /room-gl-dev (the canvas) in one
// browser at the same viewport and camera pose, then reports, outside the
// letter board, its chains, the ceiling beams and the corner controls (the DOM
// room draws board and beams in a layer above everything; the canvas
// depth-tests the beams), the mean absolute difference per channel and the
// share of 8x8 blocks whose mean differs by more than 12 and more than 32,
// overall and per region (back, left, right walls, floor, ceiling). Writes a
// side-by-side crop of the worst region for each run.
//
// Usage: node scripts/ui-check/room-gl-compare.mjs [--base http://localhost:3611]
//   [--viewports 1280x900,1440x900] [--dpr 1,2] [--poses A,B,C] [--sw]
//   [--out scripts/ui-check/out/room-gl-compare] [--json] [--full]
// --sw: Playwright's default headless shell (SwiftShader WebGL) instead of
// the GPU build of Chromium.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const o = {
  base: opt('base', 'http://localhost:3611'),
  viewports: opt('viewports', '1280x900,1440x900').split(',').map((s) => s.split('x').map(Number)),
  dprs: opt('dpr', '1,2').split(',').map(Number),
  poses: opt('poses', 'A,B,C').split(','),
  out: opt('out', path.join(__dirname, 'out', 'room-gl-compare')),
  sw: args.includes('--sw'),
  json: args.includes('--json'),
  // Also write the full DOM shot, canvas shot and their difference (x4).
  full: args.includes('--full'),
};

const POSES = {
  A: { mode: 'read', mx: 0, my: 0, t: 0 },
  B: { mode: 'explore', mx: 0.6, my: -0.5, t: 11 },
  C: { mode: 'read', mx: -1, my: 1, t: 0 },
};

// Region of each block, by the scene quads that make the room's shell.
const REGIONS = {
  back: /^plane:(rs-back-|rc-)/,
  left: /^plane:rw-(?!view)/,
  right: /^plane:rs-right$/,
  floor: /^plane:rs-floor$/,
  ceiling: /^plane:rs-ceil$/,
};

// Poses a page as room-gpu-sweep.mjs does: mode by the .gp-ctl button,
// --mx/--my on the root, the tour paused at t s, other animations finished.
async function setState(page, { mode, mx, my, t }) {
  await page.evaluate(
    async ({ mode, mx, my, t }) => {
      const root = document.querySelector('.rs-root');
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
          try {
            a.finish();
          } catch {
            /* infinite */
          }
        }
      }
    },
    { mode, mx, my, t }
  );
}

// Screen polygons (CSS px) of scene quads whose key matches, from the canvas page.
const polygons = (page, source) =>
  page.evaluate((source) => {
    const re = new RegExp(source);
    const h = window.__roomGl.handle.current;
    const cam = h.camera();
    const out = [];
    for (const q of h.scene().quads) {
      if (!re.test(q.key)) continue;
      const m = h.quadMatrix(q.key) || q.matrix;
      const pt = (u, v) => cam.project([m[0] * u + m[4] * v + m[12], m[1] * u + m[5] * v + m[13], m[2] * u + m[6] * v + m[14]].map((x, i) => x / (m[3] * u + m[7] * v + m[15])));
      out.push([pt(0, 0), pt(q.w, 0), pt(q.w, q.h), pt(0, q.h)]);
    }
    return out;
  }, source);

const inPoly = (x, y, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

const rectOf = (page, sel) =>
  page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom];
  }), sel);

async function raw(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function compare(dom, gl, w, h, dpr) {
  const [a, b] = await Promise.all([raw(await dom.screenshot()), raw(await gl.screenshot())]);
  const masks = [
    ...(await rectOf(dom, '.gp-stage2 .gp-board, .gp-stage2 .gp-chain, .gp-home, .gp-ctl')).map(([l, t, r, bt]) => [l - 8, t - 8, r + 8, bt + 8]),
  ];
  const beams = await polygons(gl, '^beam:');
  const regions = {};
  for (const [name, re] of Object.entries(REGIONS)) regions[name] = await polygons(gl, re.source);
  const B = 8;
  const stats = {};
  const bump = (name, d, blockD, n, sd) => {
    const s = (stats[name] ??= { sum: [0, 0, 0], signed: [0, 0, 0], px: 0, blocks: 0, b12: 0, b32: 0, box: [Infinity, Infinity, -Infinity, -Infinity], err: 0 });
    for (let c = 0; c < 3; c++) {
      s.sum[c] += d[c];
      s.signed[c] += sd[c];
    }
    s.px += n;
    s.blocks++;
    if (blockD > 12) s.b12++;
    if (blockD > 32) s.b32++;
  };
  for (let by = 0; by + B <= a.h; by += B) {
    for (let bx = 0; bx + B <= a.w; bx += B) {
      const cx = (bx + B / 2) / dpr;
      const cy = (by + B / 2) / dpr;
      if (masks.some(([l, t, r, bt]) => cx >= l && cx <= r && cy >= t && cy <= bt)) continue;
      if (beams.some((p) => inPoly(cx, cy, p))) continue;
      const d = [0, 0, 0];
      const ma = [0, 0, 0];
      const mb = [0, 0, 0];
      for (let y = by; y < by + B; y++) {
        for (let x = bx; x < bx + B; x++) {
          const k = (y * a.w + x) * 3;
          for (let c = 0; c < 3; c++) {
            d[c] += Math.abs(a.data[k + c] - b.data[k + c]);
            ma[c] += a.data[k + c];
            mb[c] += b.data[k + c];
          }
        }
      }
      const n = B * B;
      const blockD = Math.max(...[0, 1, 2].map((c) => Math.abs(ma[c] - mb[c]) / n));
      const region = Object.keys(regions).find((r) => regions[r].some((p) => inPoly(cx, cy, p))) ?? 'other';
      for (const name of ['all', region]) {
        bump(name, d, blockD, n, [0, 1, 2].map((c) => mb[c] - ma[c]));
        const s = stats[name];
        s.err += d[0] + d[1] + d[2];
        s.box = [Math.min(s.box[0], bx), Math.min(s.box[1], by), Math.max(s.box[2], bx + B), Math.max(s.box[3], by + B)];
      }
    }
  }
  const table = {};
  for (const [name, s] of Object.entries(stats)) {
    table[name] = {
      mad: s.sum.map((x) => +(x / s.px).toFixed(2)),
      // Mean of canvas minus DOM: a lighting or colour offset shows here.
      bias: s.signed.map((x) => +(x / s.px).toFixed(2)),
      b12: +((100 * s.b12) / s.blocks).toFixed(1),
      b32: +((100 * s.b32) / s.blocks).toFixed(1),
      blocks: s.blocks,
    };
  }
  const named = Object.keys(stats).filter((n) => n !== 'all' && n !== 'other');
  const worst = named.sort((x, y) => stats[y].err / stats[y].px - stats[x].err / stats[x].px)[0];
  return { table, worst, box: worst ? stats[worst].box : null, a, b };
}

async function crop(a, b, box, file) {
  const [x0, y0, x1, y1] = box;
  const w = Math.min(x1 - x0, 900);
  const h = Math.min(y1 - y0, 900);
  const part = async (img) =>
    sharp(img.data, { raw: { width: img.w, height: img.h, channels: 3 } }).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
  const [pa, pb] = await Promise.all([part(a), part(b)]);
  await sharp({ create: { width: w * 2 + 8, height: h, channels: 3, background: '#ff00ff' } })
    .composite([{ input: pa, left: 0, top: 0 }, { input: pb, left: w + 8, top: 0 }])
    .png()
    .toFile(file);
}

const launch = o.sw ? {} : { channel: 'chromium', args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] };
const browser = await chromium.launch(launch);
await mkdir(o.out, { recursive: true });
const results = [];
try {
  for (const [w, h] of o.viewports) {
    for (const dpr of o.dprs) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
      const [dom, gl] = await Promise.all([ctx.newPage(), ctx.newPage()]);
      for (const p of o.poses) {
        // Fresh pages per pose: a pose then starts from the page's first state.
        await Promise.all([dom.goto(`${o.base}/notes`, { waitUntil: 'load' }), gl.goto(`${o.base}/room-gl-dev`, { waitUntil: 'load' })]);
        await dom.waitForFunction(() => [...document.querySelectorAll('.rs-stage-room img')].every((i) => i.complete), null, { timeout: 30000 });
        await gl.waitForSelector('.rs-root[data-room="ready"]', { timeout: 30000 });
        await Promise.all([setState(dom, POSES[p]), setState(gl, POSES[p])]);
        await Promise.all([dom.waitForTimeout(1200), gl.waitForTimeout(1200)]);
        const name = `${w}x${h}@${dpr}-${p}`;
        const r = await compare(dom, gl, w, h, dpr);
        if (r.box) await crop(r.a, r.b, r.box, path.join(o.out, `${name}-${r.worst}.png`));
        if (o.full) {
          const d = Buffer.alloc(r.a.data.length);
          for (let i = 0; i < d.length; i++) d[i] = Math.min(255, 4 * Math.abs(r.a.data[i] - r.b.data[i]));
          const save = (data, suffix) => sharp(data, { raw: { width: r.a.w, height: r.a.h, channels: 3 } }).png().toFile(path.join(o.out, `${name}-${suffix}.png`));
          await Promise.all([save(r.a.data, 'dom'), save(r.b.data, 'gl'), save(d, 'diff')]);
        }
        results.push({ name, worst: r.worst, table: r.table });
        const all = r.table.all;
        console.log(
          `${name.padEnd(16)} mad ${all.mad.join('/')}  >12 ${all.b12}%  >32 ${all.b32}%  worst ${r.worst}  ` +
            Object.entries(r.table)
              .filter(([n]) => n !== 'all')
              .map(([n, t]) => `${n} ${t.mad.join('/')} (${t.bias.join('/')}) ${t.b12}%/${t.b32}%`)
              .join('  ')
        );
      }
      if (o.json) {
        const st = await gl.evaluate(() => window.__roomGlStats?.());
        if (st) console.log('stats', JSON.stringify(st));
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(path.join(o.out, 'results.json'), JSON.stringify(results, null, 2));
