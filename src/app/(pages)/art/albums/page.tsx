import { ArtSectionShell } from '@/components/content/ArtSectionShell';
import { ArtCover } from '@/components/content/ArtCover';
import { getAlbums } from '@/lib/art-server';

export const metadata = { title: 'albums — samer aslan' };

export default function AlbumsPage() {
  const items = getAlbums();
  return (
    <ArtSectionShell active="albums" kicker="listening">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
        {items.map((item) => (
          <ArtCover
            key={`${item.title}-${item.secondary}`}
            item={item}
            ratio="square"
          />
        ))}
      </div>
    </ArtSectionShell>
  );
}
