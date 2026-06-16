import Link from 'next/link';

export interface RelatedItem {
  href: string;
  title: string;
  blurb?: string;
}

export function RelatedAside({ items }: { items: RelatedItem[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="border-t border-rule pt-3.5 font-serif text-small">
      <p className="font-mono text-tiny uppercase text-ink-muted tracking-[0.16em] mb-2.5">
        related
      </p>
      <ul className="space-y-0">
        {items.map((item, idx) => (
          <li
            key={item.href}
            className={
              idx < items.length - 1
                ? 'py-3 border-b border-rule'
                : 'py-3'
            }
          >
            <Link href={item.href} className="block group">
              <div className="font-display italic text-[1.35rem] text-ink group-hover:text-moss-deep transition-colors">
                {item.title} →
              </div>
              {item.blurb && (
                <p className="text-ink-muted text-[0.85rem] mt-0.5">
                  {item.blurb}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
