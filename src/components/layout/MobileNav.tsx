'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { siteConfig } from '@/lib/site-config';
import { SocialIcons } from './SocialIcons';

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="primary mobile"
      className="md:hidden flex flex-col gap-3 mb-10"
    >
      <Link
        href="/"
        className={clsx(
          'font-serif text-h2',
          pathname === '/' ? 'text-sage' : 'text-ink'
        )}
      >
        {siteConfig.name}
      </Link>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-serif text-body">
        {siteConfig.nav.map((item, i) => (
          <li key={item.href} className="flex items-center gap-x-3">
            {i > 0 && <span aria-hidden className="text-ink-dim">·</span>}
            <Link
              href={item.href}
              className={isActive(item.href) ? 'text-sage' : 'text-ink hover:text-sage-deep'}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MobileExternalLinks() {
  return (
    <div className="md:hidden mt-16 pt-8 border-t border-rule">
      <SocialIcons size={20} />
    </div>
  );
}
