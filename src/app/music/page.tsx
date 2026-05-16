import { MusicMapHero } from '@/components/music-map/MusicMapHero';
import { CrossLinkCard } from '@/components/content/CrossLinkCard';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'music — samer aslan' };

export default function MusicPage() {
  return (
    <section>
      <PageTitle>music</PageTitle>

      <div className="pb-5 border-b border-rule">
        <MusicMapHero aspect={2.28} density={128} />
      </div>

      <div className="mt-6 grid gap-10 md:grid-cols-[1.6fr_1fr]">
        <div className="max-w-[60ch]">
          <h2 className="font-display italic font-medium text-[1.5rem] mb-1.5">
            How it’s built.
          </h2>
          <p className="font-serif text-[0.97rem] leading-[1.6] text-ink">
            Every album is positioned by how it sounds, not what genre tag it
            has. Audio features and a light pass over surface metadata feed an
            embedding; nearby points share sonic qualities even when their
            labels are far apart. Color encodes a loose mood/texture cluster:
            eight regions, hand-tuned.
          </p>
        </div>
        <CrossLinkCard
          href="https://www.recmyrecord.com"
          external
          title="RecMyRecord"
          description="this map is the sketch. the recommender is what to do with it."
        />
      </div>
    </section>
  );
}
