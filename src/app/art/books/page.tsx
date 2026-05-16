import { ArtSectionShell } from '@/components/content/ArtSectionShell';
import { ArtCover } from '@/components/content/ArtCover';
import { getBooks } from '@/lib/art-server';

export const metadata = { title: 'books — samer aslan' };

export default function BooksPage() {
  const items = getBooks();
  return (
    <ArtSectionShell active="books" kicker="reading">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8 max-w-[560px]">
        {items.map((item) => (
          <ArtCover
            key={`${item.title}-${item.secondary}`}
            item={item}
            ratio="poster"
          />
        ))}
      </div>
    </ArtSectionShell>
  );
}
