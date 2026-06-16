import { ArtSectionShell } from '@/components/content/ArtSectionShell';
import { ArtCover } from '@/components/content/ArtCover';
import { getFilms } from '@/lib/art-server';

export const metadata = { title: 'films — samer aslan' };

export default function FilmsPage() {
  const items = getFilms();
  return (
    <ArtSectionShell active="films" kicker="watching">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
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
