import Link from 'next/link';
import clsx from 'clsx';
import { PageTitle } from './PageTitle';

const TABS = [
  { key: 'albums', href: '/art/albums', label: 'albums' },
  { key: 'films',  href: '/art/films',  label: 'films'  },
  { key: 'books',  href: '/art/books',  label: 'books'  },
] as const;

export type ArtSection = (typeof TABS)[number]['key'];

export function ArtSectionShell({
  active,
  kicker,
  children,
}: {
  active: ArtSection;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <PageTitle>art</PageTitle>

      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-8 pb-2 border-b border-ink">
        <nav
          aria-label="art sections"
          className="flex items-baseline gap-5 font-serif text-[1.1rem]"
        >
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={clsx(
                'pb-0.5 transition-colors',
                active === t.key
                  ? 'italic text-moss border-b border-moss'
                  : 'text-ink hover:text-moss-deep'
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <span className="font-mono text-tiny uppercase text-ink-muted tracking-[0.14em]">
          {kicker}
        </span>
      </div>

      {children}
    </section>
  );
}
