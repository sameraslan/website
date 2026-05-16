'use client';

import { useEffect, useRef, useState } from 'react';
import { MusicMap, type MapStyle } from './MusicMap';

export function MusicMapHero({
  aspect = 2.02,
  density = 104,
  style = 'editorial',
  withLabels = true,
  withLegend = false,
  motion = true,
  className,
}: {
  aspect?: number;
  density?: number;
  style?: MapStyle;
  withLabels?: boolean;
  withLegend?: boolean;
  motion?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = w > 0 ? Math.round(w / aspect) : 0;

  return (
    <div ref={ref} className={className} style={{ width: '100%' }}>
      {w > 0 && h > 0 && (
        <MusicMap
          width={w}
          height={h}
          density={density}
          style={style}
          withLabels={withLabels}
          withLegend={withLegend}
          motion={motion}
        />
      )}
    </div>
  );
}
