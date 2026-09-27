import { siteConfig } from '@/lib/site-config';

const FACTS: { label: string; value: React.ReactNode }[] = [
  { label: 'now', value: siteConfig.facts.now },
  { label: 'before', value: siteConfig.facts.before },
  { label: 'where', value: siteConfig.facts.where },
  {
    label: 'listening lately',
    value: (
      <span className="italic text-ink-muted">coming soon, from Spotify</span>
    ),
  },
];

export function AboutFacts() {
  return (
    <dl className="space-y-3">
      {FACTS.map((fact) => (
        <div key={fact.label}>
          <dt className="font-mono text-tiny uppercase text-ink-muted">
            {fact.label}
          </dt>
          <dd className="font-serif text-[15px] m-0">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
