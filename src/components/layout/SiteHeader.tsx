'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { siteConfig } from '@/lib/site-config';

function isActiveFor(item: { href: string }, pathname: string) {
  if (item.href === '/') return pathname === '/';
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule">
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
