import { siteConfig } from '@/lib/site-config';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-page flex flex-wrap items-center justify-between gap-3 px-6 sm:px-10 md:px-16 py-4 font-mono text-tiny uppercase text-ink-muted">
        <span>© {year} samer aslan</span>
        <ul className="flex gap-4">
          {siteConfig.external.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                className="hover:text-moss-deep transition-colors"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
