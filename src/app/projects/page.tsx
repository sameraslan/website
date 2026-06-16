import { loadEntries } from '@/lib/content';
import { EntryRow } from '@/components/content/EntryRow';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'side projects — samer aslan' };

export default async function ProjectsPage() {
  const entries = await loadEntries('projects');
  return (
    <section>
      <PageTitle>side projects</PageTitle>
      <div>
        {entries.map((e) => (
          <EntryRow
            key={e.slug}
            entry={e}
            href={`/projects/${e.slug}`}
            kind="project"
          />
        ))}
      </div>
    </section>
  );
}
