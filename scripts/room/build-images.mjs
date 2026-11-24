// Builds the /notes room assets: webp images in public/images/room/ and the
// trimmed data files in src/data/room/ (art.json, albums.json).
//
// Usage: node scripts/room/build-images.mjs [path/to/handoff/blog-room]
// Re-runnable: every output file is overwritten.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC_DIR = path.resolve(process.argv[2] ?? path.join(ROOT, 'handoff', 'blog-room'));
const OUT_IMG = path.join(ROOT, 'public', 'images', 'room');
const OUT_DATA = path.join(ROOT, 'src', 'data', 'room');

const TEXTURES = ['wall-stone', 'wall-timber', 'floor-rustic-planks', 'beam-timber', 'wood-oak', 'wood-walnut'];
const RUGS = ['rug-kilim', 'rug-persian-red'];

let fileCount = 0;
let totalBytes = 0;

async function write(pipeline, out) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  const info = await pipeline.toFile(out);
  fileCount += 1;
  totalBytes += info.size;
  return info;
}

// Longest side capped at `cap`, never upscaled.
function capped(input, cap, quality) {
  return sharp(input).rotate().resize(cap, cap, { fit: 'inside', withoutEnlargement: true }).webp({ quality });
}

// Fixed width, never upscaled.
function widthOf(input, width, quality) {
  return sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality });
}

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(SRC_DIR, rel), 'utf-8'));
}

async function main() {
  const art = await readJson('content/art.json');
  const { albums } = await readJson('content/albums.json');

  const artOut = [];
  for (const a of art) {
    const input = path.join(SRC_DIR, a.file);
    const full = await write(capped(input, 1400, 84), path.join(OUT_IMG, 'art', `${a.id}.webp`));
    await write(widthOf(input, 480, 78), path.join(OUT_IMG, 'art', `${a.id}-480.webp`));
    artOut.push({
      id: a.id,
      artist: a.artist,
      title: a.title,
      year: String(a.year),
      width: full.width,
      height: full.height,
      role: a.role === 'window-view' ? 'window-view' : 'wall',
    });
  }

  const albumsOut = [];
  for (const a of albums) {
    const base = { id: a.id, artist: a.artist, title: a.title, year: String(a.year), type: a.type };
    if (!a.file) {
      albumsOut.push({ ...base, width: 0, height: 0, hasCover: false });
      continue;
    }
    const input = path.join(SRC_DIR, a.file);
    const full = await write(capped(input, 1000, 84), path.join(OUT_IMG, 'albums', `${a.id}.webp`));
    await write(widthOf(input, 320, 78), path.join(OUT_IMG, 'albums', `${a.id}-320.webp`));
    albumsOut.push({ ...base, width: full.width, height: full.height, hasCover: true });
  }

  for (const name of TEXTURES) {
    const input = path.join(SRC_DIR, 'assets', 'textures', `${name}.jpg`);
    await write(sharp(input).webp({ quality: 80 }), path.join(OUT_IMG, 'textures', `${name}.webp`));
  }
  for (const name of RUGS) {
    const input = path.join(SRC_DIR, 'assets', 'rugs', `${name}.jpg`);
    await write(sharp(input).webp({ quality: 80 }), path.join(OUT_IMG, 'rugs', `${name}.webp`));
  }

  await fs.mkdir(OUT_DATA, { recursive: true });
  await fs.writeFile(path.join(OUT_DATA, 'art.json'), JSON.stringify(artOut, null, 2) + '\n');
  await fs.writeFile(path.join(OUT_DATA, 'albums.json'), JSON.stringify(albumsOut, null, 2) + '\n');

  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`room images: ${fileCount} files, ${totalBytes} bytes (${mb} MB)`);
  console.log(`room data: ${artOut.length} art pieces, ${albumsOut.length} albums`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
