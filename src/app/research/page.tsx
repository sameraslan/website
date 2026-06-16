import { loadEntries } from '@/lib/content';
import { EntryRow } from '@/components/content/EntryRow';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'research — samer aslan' };

export default async function ResearchPage() {
  const entries = await loadEntries('research');
  return (
    <section>
      <PageTitle>research</PageTitle>
      <div>
        {entries.map((e) => (
          <EntryRow
            key={e.slug}
            entry={e}
            href={`/research/${e.slug}`}
            kind="research"
          />
        ))}
      </div>
    </section>
  );
}
