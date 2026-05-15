'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { siteConfig } from '@/lib/site-config';

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="primary"
      className="hidden md:flex flex-col font-serif text-body leading-loose w-[180px] sticky top-14 self-start"
    >
      <Link
        href="/"
        className={clsx(
          'mb-5 font-medium',
          pathname === '/' ? 'text-sage' : 'text-ink hover:text-sage-deep'
        )}
      >
        {siteConfig.name}
      </Link>

      <ul className="space-y-0.5 mb-10">
        {siteConfig.nav.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={clsx(
                'transition-colors',
                isActive(item.href) ? 'text-sage' : 'text-ink hover:text-sage-deep'
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="space-y-0.5 text-small">
        {siteConfig.external.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
              className="text-ink hover:text-sage-deep transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-16 text-tiny text-ink-dim italic">
        © {new Date().getFullYear()}<br />samer aslan
      </p>
    </nav>
  );
}
