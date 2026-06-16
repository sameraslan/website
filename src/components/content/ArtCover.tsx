import Image from 'next/image';
import type { ArtItem } from '@/lib/art-data';

type Ratio = 'square' | 'poster';

const ratioClass: Record<Ratio, string> = {
  square: 'aspect-square',
  poster: 'aspect-[2/3]',
};

export function ArtCover({ item, ratio }: { item: ArtItem; ratio: Ratio }) {
  return (
    <figure className="m-0 group">
      <div
        className={`relative ${ratioClass[ratio]} bg-paper-soft border border-rule overflow-hidden`}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={`${item.title} cover`}
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
            className="object-cover transition-opacity duration-300 group-hover:opacity-90"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-[repeating-linear-gradient(45deg,transparent_0_8px,rgba(35,29,20,0.03)_8px_9px)]">
            <span className="font-display italic text-ink-muted text-[1.05rem] leading-tight">
              {item.title}
            </span>
            <span className="mt-1 font-mono text-tiny uppercase text-ink-dim tracking-[0.12em]">
              {item.secondary}
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-2 font-serif">
        <p className="italic text-[0.95rem] leading-tight m-0">{item.title}</p>
        <p className="text-ink-muted text-[0.82rem] mt-0.5 leading-tight m-0">
          {item.secondary}
          {item.year && (
            <span className="font-mono text-tiny ml-1.5 align-[1px]">
              {item.year}
            </span>
          )}
        </p>
      </figcaption>
    </figure>
  );
}
