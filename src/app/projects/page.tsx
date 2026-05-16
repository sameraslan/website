import { loadEntries } from '@/lib/content';
import { EntryRow } from '@/components/content/EntryRow';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'projects — samer aslan' };

export default async function ProjectsPage() {
  const entries = await loadEntries('projects');
  return (
    <section>
      <PageTitle>projects</PageTitle>
      <div>
        {entries.map((e) => (
          <EntryRow
            key={e.slug}
            entry={e}
            href={`/projects/${e.slug}`}
            kind="project"
          />
        ))}
        <div className="py-6 border-b border-rule-soft font-serif italic text-ink-muted opacity-60 text-[1.05rem]">
          forthcoming. bloomberg things, when they’re shareable.
        </div>
      </div>
    </section>
  );
}
