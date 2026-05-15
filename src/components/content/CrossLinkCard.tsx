import Link from 'next/link';

export function CrossLinkCard({
  href,
  title,
  description,
  external = false,
}: {
  href: string;
  title: string;
  description: string;
  external?: boolean;
}) {
  const Component: typeof Link | 'a' = external ? 'a' : Link;
  const props = external
    ? { href, target: '_blank', rel: 'noreferrer' }
    : { href };

  return (
    <Component
      {...(props as { href: string })}
      className="block p-6 bg-paper-soft border border-rule rounded-sm hover:border-sage transition-colors group"
    >
      <p className="font-mono text-tiny text-ink-dim mb-2 tracking-wide">
        related project →
      </p>
      <h3 className="font-serif text-h3 text-ink group-hover:text-sage-deep transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-body text-ink-muted">{description}</p>
    </Component>
  );
}
