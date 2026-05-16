import Link from 'next/link';
import clsx from 'clsx';

export function MusicMapCaption({
  text,
  exploreHref,
  exploreLabel = 'explore the map →',
  className,
}: {
  text: string;
  exploreHref?: string;
  exploreLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'mt-5 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between',
        className
      )}
    >
      <p className="font-serif italic text-ink-muted text-[1.05rem] leading-snug max-w-[52ch]">
        {text}
      </p>
      {exploreHref && (
        <Link
          href={exploreHref}
          className="font-display italic text-[1.3rem] text-ochre border-b border-ochre pb-0.5 whitespace-nowrap self-start sm:self-auto"
        >
          {exploreLabel}
        </Link>
      )}
    </div>
  );
}
