import { loadEntries } from '@/lib/content';
import { ResearchCard } from '@/components/content/ResearchCard';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'research — samer aslan' };

export default async function ResearchPage() {
  const entries = await loadEntries('research');
  return (
    <PageShell width="list">
      <h1 className="font-serif text-h1 mb-2">research</h1>
      <p className="text-ink-muted mb-10">
        Academic work, mostly at JHU. Neuro-AI, language models, perception.
      </p>
      {entries.length === 0 ? (
        <p className="text-ink-dim italic">No research entries yet.</p>
      ) : (
        <div>
          {entries.map((e) => (
            <ResearchCard key={e.slug} entry={e} href={`/research/${e.slug}`} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
