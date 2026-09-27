'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { siteConfig } from '@/lib/site-config';
import { NOT_NARROW_MEDIA_QUERY } from '@/components/music-map/state/breakpoints';

function isActiveFor(item: { href: string }, pathname: string) {
  if (item.href === '/') return pathname === '/';
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export function SiteHeader() {
  const pathname = usePathname();
  const overlay = pathname === '/';

  return (
    <header className={overlay ? 'home-hero-header z-20' : 'border-b border-rule'}>
      {/* Overlaid header is a desktop-only affordance (spec 4.7 / Task 11):
          below 640px the header sits in normal flow above the 390px map
          instead of floating over it, so the map's own top edge (and its
          region labels) aren't hidden under header chrome. */}
      {overlay && (
        <style>{`
          @media ${NOT_NARROW_MEDIA_QUERY} {
            .home-hero-header {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              background: linear-gradient(to bottom, #faf6ec 55%, rgba(250,246,236,0) 100%);
            }
          }
        `}</style>
      )}
      <div className="mx-auto max-w-page flex items-baseline justify-between gap-6 px-6 sm:px-10 md:px-16 pt-6 pb-4">
        <Link
          href="/"
          className="font-display text-[1.75rem] leading-none tracking-tight font-medium text-ink"
        >
          {siteConfig.name}
        </Link>
        <nav aria-label="primary" className="flex flex-wrap gap-x-5 gap-y-1 justify-end">
          {siteConfig.nav.map((item) => {
            const active = isActiveFor(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'font-serif text-[0.92rem] pb-0.5 transition-colors',
                  active
                    ? 'italic text-moss border-b border-moss'
                    : 'text-ink hover:text-moss-deep'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
