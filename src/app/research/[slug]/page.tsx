import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { loadEntries, loadEntry } from '@/lib/content';
import { EntryDetailHeader } from '@/components/content/EntryDetailHeader';
import { RelatedAside } from '@/components/content/RelatedAside';

export async function generateStaticParams() {
  const entries = await loadEntries('research');
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const entry = await loadEntry('research', slug);
    return { title: `${entry.title} — samer aslan`, description: entry.subtitle };
  } catch {
    return { title: 'research — samer aslan' };
  }
}

export default async function ResearchDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await loadEntry('research', slug).catch(() => null);
  if (!entry) notFound();

  const related = [
    { href: '/projects', title: 'side projects', blurb: 'engineering side of the same questions.' },
    { href: '/music', title: 'the music map', blurb: 'where some of this lands visually.' },
  ];

  return (
    <article>
      <EntryDetailHeader entry={entry} kind="research" backHref="/research" backLabel="research" />

      <div className="grid gap-10 mt-7 md:grid-cols-[1fr_260px]">
        <div className="prose-mdx max-w-[60ch]">
          <MDXRemote source={entry.body} />
        </div>
        <RelatedAside items={related} />
      </div>
    </article>
  );
}
