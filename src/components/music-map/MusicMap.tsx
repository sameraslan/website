'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MM_CLUSTERS,
  MM_PALETTE,
  buildMapPoints,
} from '@/lib/music-data';

export type MapStyle = 'editorial' | 'journal' | 'specimen';

export interface MusicMapProps {
  width: number;
  height: number;
  density?: number;
  style?: MapStyle;
  withLabels?: boolean;
  withLegend?: boolean;
  motion?: boolean;
  className?: string;
}

const INK = '#231d14';

export function MusicMap({
  width,
  height,
  density = 96,
  style = 'editorial',
  withLabels = true,
  withLegend = false,
  motion = true,
  className,
}: MusicMapProps) {
  const points = useMemo(() => buildMapPoints(density), [density]);
  const [hover, setHover] = useState<number | null>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!motion) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setT((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  const w = width;
  const h = height;
  const showJournalGlyphs = style === 'journal';
  const showContours = style === 'specimen';
  const showRings = style === 'editorial';

  return (
    <div
      className={className}
      style={{ position: 'relative', width: w, height: h, overflow: 'hidden' }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {MM_PALETTE.map((c, i) => (
            <radialGradient id={`mm-blob-${i}`} key={i} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity={style === 'specimen' ? 0.22 : 0.32} />
              <stop offset="60%" stopColor={c} stopOpacity={0.1} />
              <stop offset="100%" stopColor={c} stopOpacity={0} />
            </radialGradient>
          ))}
          <marker id="mm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={INK} fillOpacity="0.4" />
          </marker>
        </defs>

        {/* Specimen background grid */}
        {showContours && (
          <g opacity="0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={'gx' + i} x1={((i + 1) * w) / 11} y1={0} x2={((i + 1) * w) / 11} y2={h} stroke={INK} strokeOpacity="0.05" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={'gy' + i} x1={0} y1={((i + 1) * h) / 9} x2={w} y2={((i + 1) * h) / 9} stroke={INK} strokeOpacity="0.05" />
            ))}
          </g>
        )}

        {/* Cluster glow blobs */}
        {MM_CLUSTERS.map((c, i) => (
          <ellipse
            key={c.id}
            cx={c.cx * w}
            cy={c.cy * h}
            rx={c.r * w * 1.4}
            ry={c.r * h * 1.6}
            fill={`url(#mm-blob-${i})`}
          />
        ))}

        {/* Editorial dashed contour rings */}
        {showRings &&
          MM_CLUSTERS.map((c, i) => (
            <circle
              key={'r' + c.id}
              cx={c.cx * w}
              cy={c.cy * h}
              r={c.r * Math.min(w, h) * 0.9}
              fill="none"
              stroke={MM_PALETTE[i]}
              strokeOpacity="0.3"
              strokeWidth="0.75"
              strokeDasharray="2 3"
            />
          ))}

        {/* Specimen concentric rings */}
        {showContours &&
          MM_CLUSTERS.map((c, i) => (
            <g key={'sp' + c.id} opacity="0.45">
              {[0.55, 0.8, 1.05].map((m, k) => (
                <ellipse
                  key={k}
                  cx={c.cx * w}
                  cy={c.cy * h}
                  rx={c.r * w * m}
                  ry={c.r * h * m * 1.05}
                  fill="none"
                  stroke={MM_PALETTE[i]}
                  strokeOpacity={0.5 - k * 0.13}
                  strokeWidth="0.6"
                />
              ))}
            </g>
          ))}

        {/* Constellation lines: nearest neighbors within a cluster */}
        {points.map((p, i) => {
          const within = points
            .map((q, j) => ({ q, j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 }))
            .filter(({ q, j }) => q.cluster === p.cluster && j !== i)
            .sort((a, b) => a.d - b.d)
            .slice(0, 2);
          return within.map(({ q, j }) =>
            j > i ? (
              <line
                key={`l-${i}-${j}`}
                x1={p.x * w}
                y1={p.y * h}
                x2={q.x * w}
                y2={q.y * h}
                stroke={MM_PALETTE[p.clusterIdx]}
                strokeOpacity="0.25"
                strokeWidth="0.5"
              />
            ) : null
          );
        })}

        {/* Album dots */}
        {points.map((p, i) => {
          const drift = Math.sin(t * 0.3 + p.twinkle * 6.28) * 0.6;
          const tw = 0.6 + 0.4 * Math.sin(t * 1.1 + p.twinkle * 6.28);
          const cx = p.x * w + drift;
          const cy = p.y * h + Math.cos(t * 0.25 + p.twinkle * 6.28) * 0.5;
          const isHover = hover === i;
          const r = (1.6 + p.size * 1.4) * (isHover ? 1.8 : 1);
          return (
            <g key={i}>
              {showJournalGlyphs && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 2.4}
                  fill={MM_PALETTE[p.clusterIdx]}
                  fillOpacity={0.08 * tw}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={MM_PALETTE[p.clusterIdx]}
                fillOpacity={0.55 + 0.4 * tw}
                stroke={style === 'specimen' ? INK : 'none'}
                strokeOpacity="0.2"
                strokeWidth="0.4"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}

        {/* Cluster labels */}
        {withLabels &&
          MM_CLUSTERS.map((c) => (
            <text
              key={'lb' + c.id}
              x={c.cx * w}
              y={c.cy * h - c.r * h - 6}
              textAnchor="middle"
              fontFamily="var(--font-newsreader), serif"
              fontStyle="italic"
              fontSize={style === 'specimen' ? 11 : 12}
              fill={INK}
              fillOpacity="0.55"
              style={{ pointerEvents: 'none' }}
            >
              {c.label}
            </text>
          ))}

        {/* Hover label */}
        {hover !== null &&
          (() => {
            const p = points[hover];
            const cx = p.x * w;
            const cy = p.y * h;
            const flipX = cx > w - 130;
            const flipY = cy < 30;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + (flipX ? -16 : 16)}
                  y2={cy + (flipY ? 14 : -14)}
                  stroke={INK}
                  strokeOpacity="0.5"
                  strokeWidth="0.6"
                />
                <text
                  x={cx + (flipX ? -20 : 20)}
                  y={cy + (flipY ? 20 : -18)}
                  textAnchor={flipX ? 'end' : 'start'}
                  fontFamily="var(--font-newsreader), serif"
                  fontSize="13"
                  fill={INK}
                  fillOpacity="0.95"
                >
                  {p.album}
                </text>
                <text
                  x={cx + (flipX ? -20 : 20)}
                  y={cy + (flipY ? 34 : -4)}
                  textAnchor={flipX ? 'end' : 'start'}
                  fontFamily="var(--font-plex-mono), monospace"
                  fontStyle="italic"
                  fontSize="11"
                  fill={INK}
                  fillOpacity="0.6"
                >
                  {p.artist}
                </text>
              </g>
            );
          })()}
      </svg>

      {withLegend && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontFamily: 'var(--font-plex-mono), monospace',
            fontSize: 9.5,
            color: INK,
            opacity: 0.55,
            letterSpacing: '0.06em',
          }}
        >
          {MM_PALETTE.map((c, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 8,
                  background: c,
                  display: 'inline-block',
                }}
              />
              {MM_CLUSTERS[i].label.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
