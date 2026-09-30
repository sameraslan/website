import Link from 'next/link';
import type { Entry } from '@/lib/content';

type Kind = 'project' | 'research';

function metaForKind(entry: Entry, kind: Kind) {
  const parts: string[] = [];
  if (entry.year) parts.push(String(entry.year));
  if (kind === 'project' && entry.role) parts.push(entry.role.toLowerCase());
  if (kind === 'research' && entry.affiliation) parts.push(entry.affiliation.toLowerCase());
  if (kind === 'research' && entry.venue) parts.push(entry.venue.toLowerCase());
  if (entry.stack && entry.stack.length) parts.push(entry.stack.join(' · ').toLowerCase());
  return parts.join(' · ');
}

function externalLinks(entry: Entry, kind: Kind): { label: string; href: string }[] {
  if (!entry.links) return [];
  const { github, paper, demo, site } = entry.links;
  const out: { label: string; href: string }[] = [];
  if (site) out.push({ label: 'try it', href: site });
  if (demo) out.push({ label: 'demo', href: demo });
  if (paper) out.push({ label: 'paper', href: paper });
  if (github) out.push({ label: kind === 'research' ? 'code' : 'github', href: github });
  return out;
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
  const links = externalLinks(entry, kind);

  // The title link is stretched over the whole row so the row stays one click
  // target; the external links sit above it and go straight to their sites.
  return (
    <div className="group relative grid grid-cols-[1fr_minmax(120px,200px)] gap-6 items-baseline py-6 border-b border-rule">
      <div>
        <h2 className="font-display text-[2rem] sm:text-[2.25rem] leading-none -tracking-[0.015em] font-normal text-ink group-hover:text-moss-deep transition-colors">
          <Link href={href} className="after:absolute after:inset-0">
            {entry.title}
          </Link>
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
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 font-serif italic text-[1rem] text-moss hover:text-moss-deep hover:underline"
          >
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
