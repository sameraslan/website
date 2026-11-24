#!/usr/bin/env node
// Dumps the DOM room's geometry as a fixture for the WebGL scene description
// (src/components/room/gl). For every box that draws or positions something in
// the room: its descriptor, its CSS border-box size and its four border-box
// corners (top-left, top-right, bottom-right, bottom-left in its own frame)
// projected to viewport px, at two camera poses:
//   A: reading mode, --mx 0, --my 0, everything settled;
//   B: explore mode, --mx 0.6, --my -0.5, transitions finished, the tour paused
//      at 11000 ms (its 25% keyframe).
// Corners come from 0x0 probe elements placed at the corners (inside the box,
// offset by its border; for an img, inside a temporary sibling with the img's
// geometry and transform); getBoundingClientRect maps through the 3D rig.
// For pictures, at pose A: the corners while the figure matches :hover, what
// elementFromPoint returns at the figure's projected centre, and the projected
// start of its caption.
// Also writes gl/image-sizes.json: the natural size of each room image file
// (art at 480, albums at 320, rugs), which sets the height of a picture.
//
// Software Chromium only, viewport 1280x900 at deviceScaleFactor 1 (stage scale 1).
// Usage: node scripts/ui-check/room-dump-quads.mjs [--port 3611]

import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GL = path.join(ROOT, 'src/components/room/gl');
const port = process.argv.includes('--port') ? Number(process.argv[process.argv.indexOf('--port') + 1]) : 3611;

async function imageSizes() {
  const art = JSON.parse(await readFile(path.join(ROOT, 'src/data/room/art.json'), 'utf8'));
  const albums = JSON.parse(await readFile(path.join(ROOT, 'src/data/room/albums.json'), 'utf8'));
  const size = async (f) => {
    const m = await sharp(path.join(ROOT, 'public', f)).metadata();
    return [m.width, m.height];
  };
  const out = { art: {}, albums: {}, rugs: {} };
  for (const a of art) out.art[a.id] = await size(`images/room/art/${a.id}-480.webp`);
  for (const a of albums.filter((x) => x.hasCover)) out.albums[a.id] = await size(`images/room/albums/${a.id}-320.webp`);
  for (const r of ['rug-kilim', 'rug-persian-red']) out.rugs[r] = await size(`images/room/rugs/${r}.webp`);
  return out;
}

// In the page: index every box once (window.__dq), in document order.
function indexBoxes() {
  const room = '.rs-stage-room .rs-room';
  const sel = [
    `${room} .rs-plane`,
    `${room} .rs-shade`,
    `${room} .rw-glow`,
    `${room} .rw-wains`,
    `${room} .rw-rail`,
    `${room} .rw-shaft`,
    `${room} .rc-mullion-v`,
    `${room} .rc-mullion-h`,
    `${room} img.rc-rug`,
    `${room} .rw-view img`,
    `${room} figure.rs-pc`,
    `${room} .rs-face`,
    `${room} .rc-unit > div:not(.rs-shade)`,
    `${room} .rw-lb > div:not(.rs-shade)`,
    `${room} .rc-crate-cap`,
    '.gp-stage2 .rs-room .rs-face',
    '.gp-stage2 .rs-room .gp-chain',
    '.gp-stage2 .rs-room .gp-board',
  ].join(',');
  const els = [...document.querySelectorAll(sel)];
  window.__dq = els;
  const ctx = (el) => {
    const p = el.parentElement?.closest('.rs-plane, .rs-box, .rs-stage');
    if (!p) return null;
    return p.classList.contains('rs-box') ? `${p.className} [${p.style.transform}]` : p.className;
  };
  return els.map((el) => {
    const same = [...el.parentElement.children].filter((c) => c.className === el.className && c.tagName === el.tagName);
    const cs = getComputedStyle(el);
    const bb = cs.boxSizing === 'border-box';
    const pad = (a, b) => parseFloat(cs[`padding${a}`]) + parseFloat(cs[`padding${b}`]) + parseFloat(cs[`border${a}Width`]) + parseFloat(cs[`border${b}Width`]);
    const w = parseFloat(cs.width) + (bb ? 0 : pad('Left', 'Right'));
    const h = parseFloat(cs.height) + (bb ? 0 : pad('Top', 'Bottom'));
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className,
      ctx: ctx(el),
      stage: el.closest('.gp-stage2') ? 'board' : 'room',
      i: same.indexOf(el),
      w: +w.toFixed(3),
      h: +h.toFixed(3),
    };
  });
}

// In the page: projected border-box corners of each indexed box, or of the
// listed indices only.
function corners(only) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const probe = (host, left, top) => {
    const p = document.createElement('div');
    p.style.cssText = `position:absolute;left:${left};top:${top};width:0;height:0;margin:0;padding:0;border:0;transform:none;pointer-events:none;`;
    host.append(p);
    return p;
  };
  const read = (ps) => {
    const out = ps.map((p) => {
      const r = p.getBoundingClientRect();
      return [r2(r.left), r2(r.top)];
    });
    ps.forEach((p) => p.remove());
    return out;
  };
  const cornersOf = (el) => {
    let host = el;
    let tmp = null;
    if (el.tagName === 'IMG') {
      const cs = getComputedStyle(el);
      tmp = document.createElement('div');
      const abs = cs.position === 'absolute';
      tmp.style.cssText = `position:absolute;left:${abs ? cs.left : `${el.offsetLeft}px`};top:${abs ? cs.top : `${el.offsetTop}px`};width:${cs.width};height:${cs.height};margin:0;padding:0;border:0;transform:${cs.transform};transform-origin:${cs.transformOrigin};pointer-events:none;`;
      el.after(tmp);
      host = tmp;
    }
    const cs = getComputedStyle(host);
    const [bt, br, bb, bl] = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`border${s}Width`]));
    const ps = [
      probe(host, `${-bl}px`, `${-bt}px`),
      probe(host, `calc(100% + ${br}px)`, `${-bt}px`),
      probe(host, `calc(100% + ${br}px)`, `calc(100% + ${bb}px)`),
      probe(host, `${-bl}px`, `calc(100% + ${bb}px)`),
    ];
    const out = read(ps);
    tmp?.remove();
    return out;
  };
  const els = window.__dq;
  return (only ?? els.map((_, i) => i)).map((i) => cornersOf(els[i]));
}

function rigState() {
  const root = document.querySelector('.rs-root');
  const rig = (stage) => {
    const t = (c) => getComputedStyle(document.querySelector(`${stage} .${c}`)).transform;
    return { dolly: t('rs-dolly'), sway: t('rs-sway'), cam: t('rs-cam') };
  };
  const r = root.getBoundingClientRect();
  return {
    mode: root.classList.contains('gn-explore') ? 'explore' : 'read',
    root: { left: r.left, top: r.top, width: r.width, height: r.height },
    scale: parseFloat(getComputedStyle(root).getPropertyValue('--rs-scale')) || 1,
    rig: rig('.gp-stage2'),
    roomRig: rig('.rs-stage-room'),
  };
}

async function setPose(page, { mode, mx, my, t }) {
  await page.evaluate(
    async ({ mode, mx, my, t }) => {
      const root = document.querySelector('.rs-root');
      const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      if ((mode === 'explore') !== root.classList.contains('gn-explore')) document.querySelector('.gp-ctl button').click();
      await frames();
      root.style.setProperty('--mx', String(mx));
      root.style.setProperty('--my', String(my));
      for (let k = 0; k < 3; k++) {
        await frames();
        for (const a of document.getAnimations()) {
          if (/^gn-tour/.test(a.animationName || '')) {
            a.pause();
            a.currentTime = t;
          } else {
            try { a.finish(); } catch { /* infinite */ }
          }
        }
      }
      await frames();
    },
    { mode, mx, my, t }
  );
}

async function main() {
  const browser = await chromium.launch();
  const problems = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })).newPage();
    page.on('pageerror', (e) => problems.push(e.message));
    await page.goto(`http://localhost:${port}/notes`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('.rs-stage img')];
      await Promise.race([
        Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); })))),
        new Promise((r) => setTimeout(r, 15000)),
      ]);
      // The page's own pointer handlers (parallax, board hover) stay out of the
      // hover measurements: only CSS :hover follows the mouse.
      for (const type of ['pointermove', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave'])
        window.addEventListener(type, (e) => e.stopImmediatePropagation(), true);
    });

    const descs = await page.evaluate(indexBoxes);
    const albums = await page.evaluate(() =>
      [...document.querySelectorAll('.rs-stage-room .rs-sleeve')].map((s) => {
        const m = s.querySelector('img')?.getAttribute('src')?.match(/albums\/(.+)-320\.webp/);
        return m ? m[1] : null;
      })
    );

    // Pose A.
    await setPose(page, { mode: 'read', mx: 0, my: 0, t: 0 });
    const stateA = await page.evaluate(rigState);
    const A = await page.evaluate(corners);

    // Pictures at pose A: hit at the centre, caption start, hover corners.
    const figIdx = descs.flatMap((d, i) => (d.tag === 'figure' ? [i] : []));
    const pics = await page.evaluate((figIdx) => {
      const r2 = (v) => Math.round(v * 100) / 100;
      const els = window.__dq;
      return figIdx.map((i) => {
        const fig = els[i];
        const at = (host, left, top) => {
          const p = document.createElement('div');
          p.style.cssText = `position:absolute;left:${left};top:${top};width:0;height:0;margin:0;padding:0;border:0;pointer-events:none;`;
          host.append(p);
          const r = p.getBoundingClientRect();
          p.remove();
          return [r2(r.left), r2(r.top)];
        };
        const c = at(fig, '50%', '50%');
        const hitEl = document.elementFromPoint(c[0], c[1]);
        let hit;
        const hf = hitEl?.closest('figure.rs-pc');
        if (hf === fig) hit = 'self';
        else if (hf) hit = { fig: els.indexOf(hf) };
        else if (hitEl?.closest('.gp-board')) hit = 'board';
        else if (hitEl?.closest('[data-crate]')) hit = 'crate';
        else hit = { other: hitEl ? `${hitEl.tagName.toLowerCase()}.${hitEl.className}` : null };
        const cap = fig.querySelector('figcaption');
        let capPts = null;
        if (cap) {
          const cs = getComputedStyle(cap);
          capPts = { tl: at(cap, '0px', '0px'), tr: at(cap, '100%', '0px'), right: cs.right === '0px' };
        }
        return { box: i, centre: c, hit, cap: capPts };
      });
    }, figIdx);

    await page.evaluate(`window.__corners = ${corners.toString()}`);
    // Hover: the real mouse at the figure's centre where nothing covers it;
    // otherwise (covered, off screen, or the lifted figure slides out from
    // under the mouse) :hover forced through the DevTools protocol.
    const finishAll = () =>
      page.evaluate(() => {
        for (const a of document.getAnimations()) if (!/^gn-tour/.test(a.animationName || '')) try { a.finish(); } catch { /* */ }
      });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    let byMouse = 0;
    let forced = 0;
    for (const p of pics) {
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })));
      p.hover = null;
      if (p.hit === 'self') {
        await page.mouse.move(p.centre[0], p.centre[1]);
        await page.waitForTimeout(450);
        await finishAll();
        const res = await page.evaluate((i) => ({ hovered: window.__dq[i].matches(':hover'), c: window.__corners([i])[0] }), p.box);
        await page.mouse.move(640, 897);
        await page.waitForTimeout(50);
        await finishAll();
        if (res.hovered) {
          p.hover = res.c;
          p.hoverBy = 'mouse';
          byMouse++;
          continue;
        }
      }
      await page.evaluate((i) => window.__dq[i].setAttribute('data-dq-hover', ''), p.box);
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-dq-hover]' });
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
      await page.waitForTimeout(30);
      await finishAll();
      const res = await page.evaluate((i) => ({ hovered: window.__dq[i].matches(':hover'), c: window.__corners([i])[0] }), p.box);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await page.evaluate((i) => window.__dq[i].removeAttribute('data-dq-hover'), p.box);
      await page.waitForTimeout(30);
      await finishAll();
      p.hover = res.c;
      p.hoverBy = 'forced';
      forced++;
    }
    const stateA2 = await page.evaluate(rigState);
    if (JSON.stringify(stateA2.rig) !== JSON.stringify(stateA.rig)) problems.push('rig moved during the hover pass');

    // Pose B.
    await page.mouse.move(640, 897);
    await setPose(page, { mode: 'explore', mx: 0.6, my: -0.5, t: 11000 });
    const stateB = await page.evaluate(rigState);
    const B = await page.evaluate(corners);

    for (const s of [stateA, stateB]) if (JSON.stringify(s.rig) !== JSON.stringify(s.roomRig)) problems.push(`the two stages' rigs differ in ${s.mode}`);

    const fixture = {
      note: 'Dumped by scripts/ui-check/room-dump-quads.mjs from the DOM room. Corners: [TL, TR, BR, BL] of the border box in its own frame, viewport px.',
      viewport: [1280, 900],
      albums,
      poses: { A: stateA, B: stateB },
      boxes: descs.map((d, i) => ({ ...d, A: A[i], B: B[i] })),
      pictures: pics.map(({ box, centre, hit, hover, hoverBy, cap }) => ({ box, centre, hit, hover, hoverBy, cap })),
    };
    await mkdir(path.join(GL, '__fixtures__'), { recursive: true });
    await writeFile(path.join(GL, '__fixtures__/dom-quads.json'), JSON.stringify(fixture));
    await writeFile(path.join(GL, 'image-sizes.json'), JSON.stringify(await imageSizes(), null, 0));
    const hits = pics.reduce((m, p) => ((m[typeof p.hit === 'string' ? p.hit : Object.keys(p.hit)[0]] = (m[typeof p.hit === 'string' ? p.hit : Object.keys(p.hit)[0]] ?? 0) + 1), m), {});
    console.log(`boxes ${descs.length}, pictures ${pics.length}, hover records ${pics.filter((p) => p.hover).length} (${byMouse} by mouse, ${forced} forced), hits ${JSON.stringify(hits)}`);
    console.log(`pose A rig ${JSON.stringify(stateA.rig)}\npose B rig ${JSON.stringify(stateB.rig)}`);
    if (problems.length) console.log(`problems:\n${problems.join('\n')}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
