import Link from 'next/link';
import type { Entry } from '@/lib/content';

export function ResearchCard({ entry, href }: { entry: Entry; href: string }) {
  return (
    <Link
      href={href}
      className="group block py-6 border-b border-rule last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h3 className="font-serif text-h3 text-ink group-hover:text-sage-deep transition-colors">
          {entry.title}
        </h3>
        {entry.year && (
          <span className="font-mono text-tiny text-ink-dim">{entry.year}</span>
        )}
      </div>
      {entry.subtitle && (
        <p className="text-body text-ink-muted mb-2">{entry.subtitle}</p>
      )}
      {entry.affiliation && (
        <p className="font-mono text-tiny text-ink-dim tracking-wide">
          {entry.affiliation}
        </p>
      )}
    </Link>
  );
}
