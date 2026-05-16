import Link from 'next/link';

export function CrossLinkCard({
  href,
  title,
  description,
  external = false,
  label = 'cross-link',
}: {
  href: string;
  title: string;
  description: string;
  external?: boolean;
  label?: string;
}) {
  const props = external
    ? { href, target: '_blank' as const, rel: 'noreferrer' as const }
    : { href };

  const Inner = (
    <>
      <p className="font-mono text-tiny uppercase tracking-[0.16em] text-moss">
        {label}
      </p>
      <p className="font-display italic text-[1.55rem] mt-1 text-ink">
        {title} →
      </p>
      <p className="font-serif text-[0.88rem] text-ink-muted mt-1.5 leading-snug">
        {description}
      </p>
    </>
  );

  return external ? (
    <a
      {...props}
      className="block p-5 bg-paper-soft border border-rule hover:border-moss transition-colors"
    >
      {Inner}
    </a>
  ) : (
    <Link
      href={href}
      className="block p-5 bg-paper-soft border border-rule hover:border-moss transition-colors"
    >
      {Inner}
    </Link>
  );
}
