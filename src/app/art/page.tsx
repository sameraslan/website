import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'art — samer aslan' };

interface MusicItem { title: string; artist: string; year: number; rating: number; note?: string }
interface FilmItem  { title: string; dir: string;    year: number; rating: number; note?: string }
interface BookItem  { title: string; author: string; year: number; rating: number; note?: string }

const ART_MUSIC: MusicItem[] = [
  { title: 'Loveless',              artist: 'My Bloody Valentine', year: 1991, rating: 5.0, note: 'the ceiling.' },
  { title: 'For Emma, Forever Ago', artist: 'Bon Iver',            year: 2008, rating: 4.5, note: 'cabin record, still.' },
  { title: 'Untrue',                artist: 'Burial',              year: 2007, rating: 5.0, note: 'city at 3am.' },
  { title: 'Sleep',                 artist: 'Max Richter',         year: 2015, rating: 4.0, note: 'on overnight trains.' },
  { title: 'A Seat at the Table',   artist: 'Solange',             year: 2016, rating: 4.5 },
  { title: 'Carrie & Lowell',       artist: 'Sufjan Stevens',      year: 2015, rating: 4.5, note: 'plays in the kitchen.' },
];

const ART_FILM: FilmItem[] = [
  { title: 'Stalker',              dir: 'Tarkovsky',   year: 1979, rating: 5.0 },
  { title: 'In the Mood for Love', dir: 'Wong Kar-wai', year: 2000, rating: 5.0, note: 'every time.' },
  { title: 'Synecdoche, New York', dir: 'Kaufman',     year: 2008, rating: 4.5 },
  { title: 'The Tree of Life',     dir: 'Malick',      year: 2011, rating: 4.5 },
  { title: 'Past Lives',           dir: 'Celine Song', year: 2023, rating: 4.5 },
];

const ART_BOOKS: BookItem[] = [
  { title: 'The Master and His Emissary', author: 'Iain McGilchrist',    year: 2009, rating: 4.5, note: 'currently, slowly.' },
  { title: 'The Mind in the Cave',        author: 'David Lewis-Williams', year: 2002, rating: 4.5 },
  { title: 'Gilead',                       author: 'Marilynne Robinson',  year: 2004, rating: 5.0 },
  { title: 'A Lover’s Discourse',          author: 'Roland Barthes',      year: 1977, rating: 4.5 },
  { title: 'Steps to an Ecology of Mind',  author: 'Gregory Bateson',     year: 1972, rating: 4.0 },
];

function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="font-serif text-ochre" style={{ letterSpacing: '0.04em' }}>
      {'★'.repeat(full)}
      {half ? '✬' : ''}
      <span style={{ opacity: 0.28 }}>{'★'.repeat(empty)}</span>
    </span>
  );
}

type ArtRow = (MusicItem | FilmItem | BookItem) & { secondary: string };

function ArtList({ items }: { items: ArtRow[] }) {
  return (
    <ul className="m-0 p-0 list-none">
      {items.map((it) => (
        <li
          key={`${it.title}-${it.secondary}`}
          className="grid grid-cols-[1fr_92px_56px] gap-4 items-baseline py-2 border-b border-dotted border-rule font-serif text-[0.97rem]"
        >
          <div>
            <span className="italic">{it.title}</span>
            <span className="text-ink-muted"> · {it.secondary}</span>
            {it.note && (
              <span className="text-ink-muted text-[0.85rem] ml-2"> · {it.note}</span>
            )}
          </div>
          <div className="text-[0.85rem]">
            <Stars value={it.rating} />
          </div>
          <div className="font-mono text-tiny text-ink-muted text-right">{it.year}</div>
        </li>
      ))}
    </ul>
  );
}

export default function ArtPage() {
  return (
    <section>
      <PageTitle>art</PageTitle>

      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <p className="font-serif italic text-ink-muted text-[1.05rem] max-w-[60ch] m-0">
          a small shelf of records, films, and books, with stars and the odd
          note. updated when something sticks.
        </p>
        <p className="font-mono text-tiny uppercase text-ink-muted tracking-[0.14em]">
          rym · letterboxd · goodreads, condensed
        </p>
      </div>

      <div className="mt-6 grid gap-x-14 gap-y-7 sm:grid-cols-2">
        <section className="border-t border-ink pt-3">
          <h2 className="font-display font-normal text-[1.5rem] mb-2 -tracking-[0.01em]">Music</h2>
          <ArtList items={ART_MUSIC.map((m) => ({ ...m, secondary: m.artist }))} />
        </section>

        <section className="border-t border-ink pt-3">
          <h2 className="font-display font-normal text-[1.5rem] mb-2 -tracking-[0.01em]">Film</h2>
          <ArtList items={ART_FILM.map((m) => ({ ...m, secondary: m.dir }))} />
        </section>

        <section className="border-t border-ink pt-3 sm:col-span-2">
          <h2 className="font-display font-normal text-[1.5rem] mb-2 -tracking-[0.01em]">Books</h2>
          <ArtList items={ART_BOOKS.map((m) => ({ ...m, secondary: m.author }))} />
        </section>
      </div>
    </section>
  );
}
