// Intersect the RYM matches (see match_rym.py) with the 4081-album catalog and
// rewrite public/data/{positions,metadata}.json plus a repacked atlas.
//
// Usage: node build.mjs <catalog_dir> <work_dir>
// <catalog_dir> holds the full pipeline output (metadata.json,
// positions.json, atlas-0..3.webp); <work_dir> is match_rym.py's output.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { cleanArtist } from "./clean-artist.mjs";

const [CATALOG, WORK] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const WT = path.resolve(HERE, "../..");
// sharp ships with next; it is not a direct dependency.
const sharp = createRequire(path.join(WT, "package.json"))("sharp");
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const meta = rd(`${CATALOG}/metadata.json`);
const positions = rd(`${CATALOG}/positions.json`);
const matches = rd(`${WORK}/matches.json`); // catalog id -> { rym: row }
const ov = fs.existsSync(`${HERE}/overrides.json`) ? rd(`${HERE}/overrides.json`) : { remove: [], add: [] };

// catalog id -> RYM year
const yearById = new Map();
for (const [id, v] of Object.entries(matches)) yearById.set(id, parseInt(v.rym[6], 10) || 0);
for (const id of ov.remove) yearById.delete(id);
if (ov.add.length) {
  const rym = new Map(rd(`${WORK}/rated_rows.json`).map((r) => [r[0], r]));
  for (const a of ov.add) {
    const r = rym.get(a.rym_id);
    if (!r) throw new Error(`override rym_id not found/rated: ${a.rym_id}`);
    yearById.set(a.catalog_id, parseInt(r[6], 10) || 0);
  }
}
const metaIds = new Set(meta.map((m) => m.id));
for (const id of yearById.keys()) if (!metaIds.has(id)) throw new Error(`unknown catalog id ${id}`);

// Keep metadata's original cluster-then-popularity order; repack sprites.
const THUMB = 96, PER_ROW = 32, SHEET = THUMB * PER_ROW, PER_SHEET = PER_ROW * PER_ROW;
const kept = meta.filter((m) => yearById.has(m.id));
const sheets = [];
const newMeta = [];
const origAtlas = {};
for (let i = 0; i < kept.length; i++) {
  const m = kept[i];
  const sheet = Math.floor(i / PER_SHEET), slot = i % PER_SHEET;
  if (!sheets[sheet]) sheets[sheet] = [];
  const src = (origAtlas[m.atlasIndex] ??= sharp(`${CATALOG}/atlas-${m.atlasIndex}.webp`));
  const [u, v] = m.atlasUV;
  const tile = await src.clone()
    .extract({ left: Math.round(u * SHEET), top: Math.round(v * SHEET), width: THUMB, height: THUMB })
    .png().toBuffer();
  const col = slot % PER_ROW, row = Math.floor(slot / PER_ROW);
  sheets[sheet].push({ input: tile, left: col * THUMB, top: row * THUMB });
  newMeta.push({
    ...m,
    artist: cleanArtist(m.artist),
    year: yearById.get(m.id),
    atlasIndex: sheet,
    atlasUV: [(col * THUMB) / SHEET, (row * THUMB) / SHEET, THUMB / SHEET, THUMB / SHEET],
  });
}
const out = path.join(WT, "public/data");
for (const f of fs.readdirSync(out)) if (/^atlas-\d+\.webp$/.test(f)) fs.unlinkSync(path.join(out, f));
for (let s = 0; s < sheets.length; s++) {
  await sharp({ create: { width: SHEET, height: SHEET, channels: 3, background: { r: 246, g: 240, b: 225 } } })
    .composite(sheets[s]).webp({ quality: 80 }).toFile(path.join(out, `atlas-${s}.webp`));
}
const keptSet = new Set(kept.map((m) => m.id));
const newPos = positions.filter((p) => keptSet.has(p.id));
fs.writeFileSync(path.join(out, "metadata.json"), JSON.stringify(newMeta));
fs.writeFileSync(path.join(out, "positions.json"), JSON.stringify(newPos));
console.log(`albums ${newMeta.length}, positions ${newPos.length}, sheets ${sheets.length}`);
