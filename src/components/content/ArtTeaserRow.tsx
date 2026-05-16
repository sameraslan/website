import Link from 'next/link';
import { ArtCover } from './ArtCover';
import type { ArtItem } from '@/lib/art-data';

export function ArtTeaserRow({
  title,
  kicker,
  href,
  items,
  ratio,
  show = 4,
}: {
  title: string;
  kicker: string;
  href: string;
  items: ArtItem[];
  ratio: 'square' | 'poster';
  show?: number;
}) {
  const teasers = items.slice(0, show);
  const remaining = items.length - teasers.length;

  return (
    <section className="mt-2">
      <div className="flex items-baseline justify-between mb-5 pb-2 border-b border-ink">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display font-normal text-[1.6rem] -tracking-[0.01em]">
            {title}
          </h2>
          <span className="font-mono text-tiny uppercase text-ink-muted tracking-[0.14em]">
            {kicker}
          </span>
        </div>
        <Link
          href={href}
          className="font-serif italic text-[1rem] text-moss hover:text-moss-deep transition-colors"
        >
          {remaining > 0 ? `see all ${items.length}` : 'see all'} →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
        {teasers.map((item) => (
          <Link
            key={`${item.title}-${item.secondary}`}
            href={href}
            className="block"
          >
            <ArtCover item={item} ratio={ratio} />
          </Link>
        ))}
      </div>
    </section>
  );
}
