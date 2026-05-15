import { loadListening } from '@/lib/music-data';
import { MusicMap } from '@/components/music-map/MusicMap';
import { MusicMapCaption } from '@/components/music-map/MusicMapCaption';
import { CrossLinkCard } from '@/components/content/CrossLinkCard';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'music — samer aslan' };

export default async function MusicPage() {
  const data = await loadListening();

  return (
    <PageShell width="prose">
      <h1 className="font-serif text-h1 mb-2">music</h1>
      <p className="text-ink-muted mb-10">
        a map of my listening — proximity by sound, color by mood
      </p>

      <div className="w-full mb-2">
        <MusicMap width={680} height={420} data={data} />
      </div>
      <MusicMapCaption text="hover an album to see what's near it" />

      <section className="mt-16 space-y-6 text-body">
        <h2 className="font-serif text-h2">how the map is built</h2>
        <p>
          Each album is positioned by how it sounds, not by what genre tag it carries. Audio features and
          surface metadata feed an embedding; nearby points are albums that share sonic qualities even when
          their genre labels are far apart.
        </p>
        <p>
          Color encodes a cluster — a rough mood / texture category. The clusters aren&apos;t strict genres; they
          emerge from the audio.
        </p>
        <p>
          The data is just a JSON file on this site. The viz itself is a separate component that will keep
          improving as I add albums and refine the embedding.
        </p>
      </section>

      <section className="mt-16">
        <CrossLinkCard
          href="https://www.recmyrecord.com"
          external
          title="RecMyRecord"
          description="If this idea — finding music by how it sounds rather than how it's tagged — interests you, RecMyRecord is the full version: an album recommender built on the same intuition."
        />
      </section>
    </PageShell>
  );
}
