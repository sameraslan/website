import { loadEntries } from '@/lib/content';
import { ProjectCard } from '@/components/content/ProjectCard';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'projects — samer aslan' };

export default async function ProjectsPage() {
  const entries = await loadEntries('projects');
  return (
    <PageShell width="list">
      <h1 className="font-serif text-h1 mb-2">projects</h1>
      <p className="text-ink-muted mb-10">
        Personal projects. Work projects (Bloomberg) added when shareable.
      </p>
      {entries.length === 0 ? (
        <p className="text-ink-dim italic">No projects yet.</p>
      ) : (
        <div>
          {entries.map((e) => (
            <ProjectCard key={e.slug} entry={e} href={`/projects/${e.slug}`} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
