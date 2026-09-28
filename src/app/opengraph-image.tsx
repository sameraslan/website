import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site-config';

export const runtime = 'nodejs';

export const alt = siteConfig.meta.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#faf6ec';
const INK = '#231d14';
const MUTED = '#6b5e47';

// The three heavily-populated region colours first, then the rest.
const REGION_COLORS = [
  '#b6532a',
  '#5b7855',
  '#3a6655',
  '#a8945c',
  '#8a3a2a',
  '#6a4860',
  '#7c8255',
  '#5a7080',
];

// Small deterministic pseudo-random generator (mulberry32) so the disc
// layout is stable across builds and requests instead of re-randomizing.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Disc = { x: number; y: number; r: number; color: string };

function generateDiscs(): Disc[] {
  const rand = mulberry32(20260926);
  const discs: Disc[] = [];

  // Three soft cluster centers on the right two-thirds of the canvas,
  // weighted toward the first three (populated) region colors.
  const clusters = [
    { cx: 700, cy: 220, spread: 160, color: REGION_COLORS[0] },
    { cx: 950, cy: 380, spread: 180, color: REGION_COLORS[1] },
    { cx: 780, cy: 500, spread: 150, color: REGION_COLORS[2] },
  ];

  for (let i = 0; i < 60; i++) {
    const cluster = clusters[i % clusters.length];
    const angle = rand() * Math.PI * 2;
    const dist = rand() * cluster.spread;
    const x = cluster.cx + Math.cos(angle) * dist;
    const y = cluster.cy + Math.sin(angle) * dist * 0.7;
    const r = 8 + rand() * 18;
    // Occasionally borrow one of the sparser region colors for variety.
    const color = rand() < 0.15 ? REGION_COLORS[3 + Math.floor(rand() * 5)] : cluster.color;
    discs.push({ x, y, r, color });
  }

  return discs;
}

async function loadDisplayFont(): Promise<ArrayBuffer | null> {
  try {
    const cssResponse = await fetch(
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&display=swap',
      {
        headers: {
          // Google Fonts serves TTF (rather than WOFF2) to older Safari UAs,
          // which is the format ImageResponse's font loader accepts.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15',
        },
      }
    );
    if (!cssResponse.ok) return null;

    const css = await cssResponse.text();
    const match = css.match(/src: url\(([^)]+)\)/);
    if (!match) return null;

    const fontResponse = await fetch(match[1]);
    if (!fontResponse.ok) return null;

    return await fontResponse.arrayBuffer();
  } catch (error) {
    console.error('opengraph-image: failed to fetch Cormorant Garamond, falling back to Georgia', error);
    return null;
  }
}

export default async function OpengraphImage() {
  const fontData = await loadDisplayFont();
  const discs = generateDiscs();
  const displayFontFamily = fontData ? 'Cormorant Garamond' : 'Georgia';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: PAPER,
          position: 'relative',
        }}
      >
        {discs.map((disc, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: disc.x - disc.r,
              top: disc.y - disc.r,
              width: disc.r * 2,
              height: disc.r * 2,
              borderRadius: '50%',
              backgroundColor: disc.color,
              opacity: 0.75,
              display: 'flex',
            }}
          />
        ))}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            paddingLeft: 80,
            paddingRight: 80,
            maxWidth: 720,
          }}
        >
          <div
            style={{
              fontFamily: displayFontFamily,
              fontSize: 72,
              fontWeight: 600,
              color: INK,
              display: 'flex',
            }}
          >
            samer aslan
          </div>
          <div
            style={{
              fontSize: 28,
              color: INK,
              marginTop: 24,
              display: 'flex',
              lineHeight: 1.4,
            }}
          >
            Hey, I'm Samer. I build AI for lawyers at Bloomberg and do research in neuroscience and AI.
          </div>
          <div
            style={{
              fontSize: 20,
              color: MUTED,
              marginTop: 20,
              display: 'flex',
            }}
          >
            a music map of my album listening
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [
            {
              name: 'Cormorant Garamond',
              data: fontData,
              style: 'normal',
              weight: 600,
            },
          ]
        : undefined,
    }
  );
}
