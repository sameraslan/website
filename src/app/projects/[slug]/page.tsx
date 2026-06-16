import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { loadEntries, loadEntry } from '@/lib/content';
import { EntryDetailHeader } from '@/components/content/EntryDetailHeader';
import { RelatedAside } from '@/components/content/RelatedAside';

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

  const related = [
    { href: '/music', title: 'the music map', blurb: 'the sketch this site grows from.' },
    { href: '/research', title: 'research', blurb: 'related lines of thinking.' },
  ];

  return (
    <article>
      <EntryDetailHeader entry={entry} kind="project" backHref="/projects" backLabel="projects" />

      <div className="grid gap-10 mt-7 md:grid-cols-[1fr_260px]">
        <div className="prose-mdx max-w-[60ch]">
          <MDXRemote source={entry.body} />
        </div>
        <RelatedAside items={related} />
      </div>
    </article>
  );
}
