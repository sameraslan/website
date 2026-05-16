import { PageTitle } from '@/components/content/PageTitle';
import { ArtTeaserRow } from '@/components/content/ArtTeaserRow';
import { getAlbums, getFilms, getBooks } from '@/lib/art-server';

export const metadata = { title: 'art — samer aslan' };

export default function ArtPage() {
  const albums = getAlbums();
  const films  = getFilms();
  const books  = getBooks();

  return (
    <section>
      <PageTitle>art</PageTitle>

      <p className="font-serif italic text-ink-muted text-[1.05rem] max-w-[60ch] m-0 mb-10">
        a small shelf of records, films, and books that keep coming back. a
        longer ledger lives on rym, letterboxd, and goodreads; this is the
        condensed version.
      </p>

      <ArtTeaserRow
        title="albums"
        kicker="listening"
        href="/art/albums"
        items={albums}
        ratio="square"
      />

      <div className="mt-14">
        <ArtTeaserRow
          title="films"
          kicker="watching"
          href="/art/films"
          items={films}
          ratio="poster"
        />
      </div>

      <div className="mt-14">
        <ArtTeaserRow
          title="books"
          kicker="reading"
          href="/art/books"
          items={books}
          ratio="poster"
        />
      </div>
    </section>
  );
}
