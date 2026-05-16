import Link from 'next/link';
import type { Entry } from '@/lib/content';

type Kind = 'project' | 'research';

function metaFields(entry: Entry, kind: Kind): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (entry.year) out.push(['year', String(entry.year)]);
  if (kind === 'project' && entry.role) out.push(['role', entry.role.toLowerCase()]);
  if (kind === 'research' && entry.affiliation) out.push(['lab', entry.affiliation.toLowerCase()]);
  if (entry.stack && entry.stack.length) out.push(['stack', entry.stack.join(' · ').toLowerCase()]);
  return out;
}

export function EntryDetailHeader({
  entry,
  kind,
  backHref,
  backLabel,
}: {
  entry: Entry;
  kind: Kind;
  backHref: string;
  backLabel: string;
}) {
  const fields = metaFields(entry, kind);
  const links = entry.links ?? {};

  return (
    <header>
      <Link
        href={backHref}
        className="font-mono text-tiny uppercase text-ink-muted hover:text-moss-deep tracking-[0.18em]"
      >
        ← {backLabel}
      </Link>

      <h1 className="font-display font-normal mt-3 leading-[0.92] -tracking-[0.025em] text-[3rem] sm:text-[4.25rem]">
        {entry.title}
      </h1>

      {entry.subtitle && (
        <p className="font-serif italic text-ink-muted mt-2.5 text-[1.15rem] sm:text-[1.25rem] leading-snug max-w-[52ch]">
          {entry.subtitle.toLowerCase()}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-tiny uppercase text-ink-muted">
        {fields.map(([k, v]) => (
          <span key={k}>
            <span className="opacity-60 mr-1.5">{k}</span>
            {v}
          </span>
        ))}
        {links.github && (
          <a
            href={links.github}
            target="_blank"
            rel="noreferrer"
            className="text-moss hover:text-moss-deep normal-case tracking-[0.12em]"
          >
            {kind === 'research' ? 'code ↗' : 'github ↗'}
          </a>
        )}
        {links.paper && (
          <a
            href={links.paper}
            target="_blank"
            rel="noreferrer"
            className="text-moss hover:text-moss-deep normal-case tracking-[0.12em]"
          >
            paper ↗
          </a>
        )}
        {links.site && (
          <a
            href={links.site}
            target="_blank"
            rel="noreferrer"
            className="text-moss hover:text-moss-deep normal-case tracking-[0.12em]"
          >
            live ↗
          </a>
        )}
        {links.demo && (
          <a
            href={links.demo}
            target="_blank"
            rel="noreferrer"
            className="text-moss hover:text-moss-deep normal-case tracking-[0.12em]"
          >
            demo ↗
          </a>
        )}
      </div>
    </header>
  );
}
