'use client';

import { useEffect, useRef, useState } from 'react';
import { MusicMap, type AlbumPoint } from './MusicMap';

export function MusicMapHero({ data }: { data: AlbumPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full" style={{ height: 'min(70vh, 640px)' }}>
      {size.w > 0 && size.h > 0 && (
        <MusicMap width={size.w} height={size.h} data={data} interactive />
      )}
    </div>
  );
}
