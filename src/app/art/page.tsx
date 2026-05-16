import { existsSync } from 'node:fs';
import path from 'node:path';
import { PageTitle } from '@/components/content/PageTitle';
import { ArtCover } from '@/components/content/ArtCover';
import { ALBUMS, FILMS, BOOKS, type ArtItem } from '@/lib/art-data';

export const metadata = { title: 'art — samer aslan' };

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function resolveImage(item: ArtItem): ArtItem {
  if (item.image && existsSync(path.join(PUBLIC_DIR, item.image))) {
    return item;
  }
  return { ...item, image: undefined };
}

const albums = ALBUMS.map(resolveImage);
const films = FILMS.map(resolveImage);
const books = BOOKS.map(resolveImage);

function Grid({
  items,
  ratio,
  narrow,
}: {
  items: ArtItem[];
  ratio: 'square' | 'poster';
  narrow?: boolean;
}) {
  return (
    <div
      className={
        narrow
          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8 max-w-[560px]'
          : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8'
      }
    >
      {items.map((item) => (
        <ArtCover key={`${item.title}-${item.secondary}`} item={item} ratio={ratio} />
      ))}
    </div>
  );
}

function SectionHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="flex items-baseline justify-between mb-5 pb-2 border-b border-ink">
      <h2 className="font-display font-normal text-[1.6rem] -tracking-[0.01em]">
        {title}
      </h2>
      <span className="font-mono text-tiny uppercase text-ink-muted tracking-[0.14em]">
        {kicker}
      </span>
    </div>
  );
}

export default function ArtPage() {
  return (
    <section>
      <PageTitle>art</PageTitle>

      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-10">
        <p className="font-serif italic text-ink-muted text-[1.05rem] max-w-[60ch] m-0">
          a small shelf of records, films, and books that keep coming back. a
          longer ledger lives on rym, letterboxd, and goodreads; this is the
          condensed version.
        </p>
      </div>

      <section className="mt-2">
        <SectionHeader title="albums" kicker="listening" />
        <Grid items={albums} ratio="square" />
      </section>

      <section className="mt-14">
        <SectionHeader title="films" kicker="watching" />
        <Grid items={films} ratio="poster" />
      </section>

      <section className="mt-14">
        <SectionHeader title="books" kicker="reading" />
        <Grid items={books} ratio="poster" narrow />
      </section>
    </section>
  );
}
