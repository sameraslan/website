import Link from 'next/link';
import type { Entry } from '@/lib/content';

type Kind = 'project' | 'research';

function metaForKind(entry: Entry, kind: Kind) {
  const parts: string[] = [];
  if (entry.year) parts.push(String(entry.year));
  if (kind === 'project' && entry.role) parts.push(entry.role.toLowerCase());
  if (kind === 'research' && entry.affiliation) parts.push(entry.affiliation.toLowerCase());
  if (entry.stack && entry.stack.length) parts.push(entry.stack.join(' · ').toLowerCase());
  return parts.join(' · ');
}

function linkLabels(entry: Entry, kind: Kind): string[] {
  if (!entry.links) return [];
  const labels: string[] = [];
  if (entry.links.github) labels.push(kind === 'research' ? 'code' : 'github');
  if (entry.links.paper) labels.push('paper');
  if (entry.links.demo) labels.push('demo');
  if (entry.links.site) labels.push('live');
  return labels;
}

export function EntryRow({
  entry,
  href,
  kind,
}: {
  entry: Entry;
  href: string;
  kind: Kind;
}) {
  const meta = metaForKind(entry, kind);
  const labels = linkLabels(entry, kind);

  return (
    <Link
      href={href}
      className="group grid grid-cols-[1fr_minmax(120px,200px)] gap-6 items-baseline py-6 border-b border-rule"
    >
      <div>
        <h2 className="font-display text-[2rem] sm:text-[2.25rem] leading-none -tracking-[0.015em] font-normal text-ink group-hover:text-moss-deep transition-colors">
          {entry.title}
        </h2>
        {entry.subtitle && (
          <p className="font-serif italic text-ink-muted text-[1rem] mt-1.5 max-w-[54ch]">
            {entry.subtitle.toLowerCase()}
          </p>
        )}
        {meta && (
          <p className="font-mono text-tiny uppercase text-ink-muted mt-2.5">
            {meta}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        {labels.map((l) => (
          <span
            key={l}
            className="font-serif italic text-[1rem] text-moss"
          >
            {l} →
          </span>
        ))}
      </div>
    </Link>
  );
}
