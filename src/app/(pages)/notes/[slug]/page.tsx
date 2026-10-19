import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { listNoteSlugs, loadNote, noteMetadata } from '@/lib/notes';
import { EntryDetailHeader } from '@/components/content/EntryDetailHeader';
import { Figure } from '@/components/content/Figure';
import { mdxComponents } from '@/components/content/mdxComponents';

// Unlisted: only slugs that exist in src/notes/ are built, anything else 404s.
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await listNoteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await loadNote(slug).catch(() => undefined);
  return noteMetadata(entry);
}

export default async function NoteDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await loadNote(slug).catch(() => null);
  if (!entry) notFound();

  return (
    // One centered reading column (about 60ch of body text) for header and body.
    <article className="mx-auto max-w-[35rem]">
      <EntryDetailHeader entry={entry} kind="research" backHref="/research" backLabel="research" />
      <div className="prose-mdx mt-7">
        <MDXRemote source={entry.body} components={{ ...mdxComponents, Figure }} />
      </div>
    </article>
  );
}
