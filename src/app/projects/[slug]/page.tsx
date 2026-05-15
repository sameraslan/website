import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import { loadEntries, loadEntry } from '@/lib/content';
import { PageShell } from '@/components/layout/PageShell';

export async function generateStaticParams() {
  const entries = await loadEntries('projects');
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const entry = await loadEntry('projects', slug);
    return { title: `${entry.title} — samer aslan`, description: entry.subtitle };
  } catch {
    return { title: 'project — samer aslan' };
  }
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await loadEntry('projects', slug).catch(() => null);
  if (!entry) notFound();

  return (
    <PageShell width="prose">
      <Link href="/projects" className="font-mono text-tiny text-ink-dim hover:text-sage-deep">
        ← projects
      </Link>
      <header className="mt-4 mb-10">
        <h1 className="font-serif text-h1 mb-2">{entry.title}</h1>
        {entry.subtitle && (
          <p className="text-body text-ink-muted">{entry.subtitle}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-tiny text-ink-dim">
          {entry.year && <span>{entry.year}</span>}
          {entry.role && <span>{entry.role}</span>}
          {entry.stack && entry.stack.length > 0 && <span>{entry.stack.join(' · ')}</span>}
        </div>
        {entry.links && (
          <div className="mt-3 flex flex-wrap gap-x-4 text-small">
            {entry.links.github && (
              <a href={entry.links.github} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">github</a>
            )}
            {entry.links.demo && (
              <a href={entry.links.demo} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">demo</a>
            )}
            {entry.links.site && (
              <a href={entry.links.site} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">site</a>
            )}
            {entry.links.paper && (
              <a href={entry.links.paper} target="_blank" rel="noreferrer" className="text-sage hover:text-sage-deep">paper</a>
            )}
          </div>
        )}
      </header>
      <article className="prose-mdx">
        <MDXRemote source={entry.body} />
      </article>
    </PageShell>
  );
}
