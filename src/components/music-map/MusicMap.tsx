import clsx from 'clsx';
import type { AlbumPoint } from '@/lib/music-data';

export interface MusicMapProps {
  className?: string;
  width: number;
  height: number;
  data?: AlbumPoint[];
  interactive?: boolean;
  onHoverAlbum?: (album: AlbumPoint | null) => void;
  onClickAlbum?: (album: AlbumPoint) => void;
}

export type { AlbumPoint };

const CLUSTER_COLORS: Record<string, string> = {
  sage:       '#5b7855',
  olive:      '#7c8255',
  forest:     '#3a6655',
  oxblood:    '#8a3a2a',
  terracotta: '#b6532a',
  amber:      '#a8945c',
  slate:      '#5a7080',
  plum:       '#6a4860',
};

export function MusicMap({ className, width, height, data = [] }: MusicMapProps) {
  if (data.length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center text-ink-dim italic text-small',
          className
        )}
        style={{ width, height }}
      >
        map is regenerating, check back soon
      </div>
    );
  }

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="album proximity map"
    >
      <rect width={width} height={height} fill="transparent" />
      {data.map((album) => {
        const cx = album.x * width;
        const cy = album.y * height;
        const r = album.size ?? 10;
        const fill = CLUSTER_COLORS[album.cluster ?? ''] ?? '#5b7855';
        return (
          <g key={album.id}>
            <circle cx={cx} cy={cy} r={r} fill={fill} opacity={0.85} />
            <text
              x={cx + r + 4}
              y={cy + 4}
              fontFamily="var(--font-newsreader), serif"
              fontSize={11}
              fill="#2d2a22"
            >
              {album.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
