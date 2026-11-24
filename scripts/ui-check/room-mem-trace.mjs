#!/usr/bin/env node
// Tile memory of the /notes room, from a cc trace of the GPU-composited page.
// Usage: node scripts/ui-check/room-mem-trace.mjs [--port 3477] [--vp 1440x900] [--mode read|explore]
//   [--budget 4096] [--motion] [--css "..."] [--top 30] [--screen 3456x2234] [--shot file.png]
// With a lifted budget the sum of gpu_memory_usage over the active tree's layers
// is what the room needs; --motion sweeps the mouse (tour running in explore)
// while tracing and reports the largest total seen. Prints the largest layer
// groups with their raster scale, then the total by kind of layer.
import { chromium } from 'playwright';
import { readFile, rm } from 'node:fs/promises';

const o = { vp: '1440x900', mode: 'read', budget: 4096, motion: false, css: '', top: 30, screen: '', shot: '', port: 3477, wait: 0 };
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i++) {
  const k = a[i].replace(/^--/, '');
  if (k === 'motion') o.motion = true;
  else o[k] = typeof o[k] === 'number' ? Number(a[++i]) : a[++i];
}
const [w, h] = o.vp.split('x').map(Number);

let chromeH = 87, browser, page;
for (let t = 0; t < 2; t++) {
  const args = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--force-device-scale-factor=2', `--window-size=${w},${h + chromeH}`];
  if (o.screen) args.push(`--screen-info={${o.screen} devicePixelRatio=2}`);
  if (o.budget) args.push(`--force-gpu-mem-available-mb=${o.budget}`);
  browser = await chromium.launch({ channel: 'chromium', args });
  page = await (await browser.newContext({ viewport: null })).newPage();
  await page.goto('about:blank');
  const ih = await page.evaluate(() => innerHeight);
  if (ih === h) break;
  await browser.close();
  chromeH += h - ih;
}
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
await page.goto(`http://localhost:${o.port}/notes`, { waitUntil: 'load' });
if (o.css) await page.addStyleTag({ content: o.css });
await page.waitForTimeout(3200);
await page.evaluate(async (mode) => {
  const root = document.querySelector('.rs-root');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
  if ((mode === 'explore') !== root.classList.contains('gn-explore')) document.querySelector('.gp-ctl button').click();
  const imgs = [...document.querySelectorAll('.rs-stage img')];
  await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => null))), new Promise((r) => setTimeout(r, 15000))]);
}, o.mode);
await page.waitForTimeout(2500 + o.wait);
const file = new URL(`./out/room-mem-${process.pid}.json`, import.meta.url).pathname;
await browser.startTracing(page, { path: file, categories: ['disabled-by-default-cc.debug'] });
if (o.motion) {
  for (const [x, y] of [[0.02, 0.02], [0.98, 0.05], [0.95, 0.95], [0.05, 0.9], [0.5, 0.5], [0.98, 0.5]]) {
    await page.mouse.move(x * w, y * h, { steps: 30 });
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })));
  }
} else {
  // A tiny composited animation forces frames, so cc emits its snapshots at rest.
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;background:#000;z-index:9;animation:memtick .2s infinite alternate';
    const st = document.createElement('style');
    st.textContent = '@keyframes memtick{to{opacity:.5}}';
    document.head.append(st);
    document.body.append(d);
  });
  await page.waitForTimeout(1500);
}
if (o.shot) await page.screenshot({ path: o.shot });
await browser.stopTracing();
await browser.close();

const tr = JSON.parse(await readFile(file, 'utf8'));
await rm(file);
const snaps = (tr.traceEvents || tr).filter((e) => e.ph === 'O' && e.name === 'cc::LayerTreeHostImpl').map((e) => e.args.snapshot);
let best = null, bestT = -1;
for (const s of snaps) {
  const L = s.active_tree?.layers || [];
  const t = L.reduce((n, l) => n + (l.gpu_memory_usage || 0), 0);
  if (o.motion ? t > bestT : true) { best = s; bestT = t; }
}
const MB = (b) => (b / 1048576).toFixed(1);
// Tiles of the chosen frame by priority bin: NOW tiles must fit the budget or cc stops rasterizing.
const bins = {};
for (const t of best.active_tiles || []) {
  const b = t.combined_priority?.priority_bin ?? t.active_priority?.priority_bin ?? '?';
  bins[b] = (bins[b] || 0) + (t.gpu_memory_usage || 0);
}
if (process.env.TILEKEYS) console.log(JSON.stringify((best.active_tiles || [])[0]).slice(0, 1200));
console.log('tiles by priority bin (MB):', Object.entries(bins).map(([k, v]) => `${k} ${MB(v)}`).join(', '));
const L = best.active_tree.layers;
console.log(`${o.vp} ${o.mode} ${o.motion ? 'motion(max)' : 'rest'} budget ${o.budget || 'default'}: ${snaps.length} snapshots, layers ${L.length}, drawing ${L.filter((l) => l.draws_content).length}, tile memory ${MB(bestT)} MB`);
console.log('tile manager:', JSON.stringify(best.tile_manager_basic_state?.global_state || best.tile_manager_basic_state).slice(0, 400));
if (process.env.LAYERKEYS) console.log(JSON.stringify(L.find((l) => l.gpu_memory_usage > 1e7) || L[0]).slice(0, 2000));
// Raster scale of a layer: the scale of its highest-resolution tiling.
const scaleOf = (l) => {
  const t = l.tilings || l.pictures_tilings || [];
  const s = t.map((x) => x.content_scale ?? x.raster_scale ?? x.contents_scale).filter((v) => v != null);
  const v = s.length ? Math.max(...s.map((x) => (typeof x === 'object' ? Math.max(...Object.values(x)) : x))) : l.ideal_contents_scale ?? l.raster_scale;
  return v != null ? +Number(v).toFixed(3) : '?';
};
const groups = {};
for (const l of L) {
  const n = (l.layer_name || '?').replace(/ id='[^']*'/, '').slice(0, 90);
  groups[n] ??= { n: 0, mem: 0, b: l.bounds, scales: new Set() };
  groups[n].n++;
  groups[n].mem += l.gpu_memory_usage || 0;
  if (l.gpu_memory_usage) groups[n].scales.add(scaleOf(l));
}
for (const [n, g] of Object.entries(groups).sort((x, y) => y[1].mem - x[1].mem).slice(0, o.top)) {
  if (!g.mem) break;
  console.log(`${MB(g.mem).padStart(7)} MB  x${String(g.n).padEnd(3)} ${g.b.width}x${g.b.height}  scale ${[...g.scales].join('/')}  ${n}`);
}
// The room's layers by kind (by class name; first match wins).
const kinds = [
  ['window views (.rw-view, .rw-vg)', /rw-view|rw-vg/],
  ['overlays (.rs-shade, .rw-glow, .rw-wains, .rw-rail, .rw-shaft)', /rs-shade|rw-glow|rw-wains|rw-rail|rw-shaft/],
  ['pictures (.rs-pc)', /rs-pc/],
  ['board and its stage (.gp-*)', /gp-/],
  ['vignette and grain', /rs-vignette|rs-grain/],
  ['planes (.rs-plane: walls, floor, ceiling, reveals)', /rs-plane/],
  ['boxes and faces (.rs-box, .rs-face)', /rs-box|rs-face/],
];
const sums = {};
for (const l of L) {
  if (!l.gpu_memory_usage) continue;
  const k = (kinds.find(([, re]) => re.test(l.layer_name || '')) || ['other'])[0];
  sums[k] ??= { mem: 0, n: 0 };
  sums[k].mem += l.gpu_memory_usage;
  sums[k].n++;
}
console.log('by kind:');
for (const [k, s] of Object.entries(sums).sort((x, y) => y[1].mem - x[1].mem)) console.log(`${MB(s.mem).padStart(7)} MB  ${String(s.n).padStart(3)} layers  ${k}`);
if (errs.length) console.log('console:', [...new Set(errs)].join('\n'));
