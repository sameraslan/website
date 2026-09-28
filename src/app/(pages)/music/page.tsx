import MusicMapClient from '@/components/music-map/MusicMapClient';
import { CrossLinkCard } from '@/components/content/CrossLinkCard';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'music · samer aslan' };

export default function MusicPage() {
  return (
    <section>
      <PageTitle>music</PageTitle>

      <div className="pb-5 border-b border-rule">
        <section className="w-full aspect-[2/1] relative">
          <MusicMapClient />
        </section>
      </div>

      <div className="mt-6 grid gap-10 md:grid-cols-[1.6fr_1fr]">
        <div className="max-w-[60ch]">
          <h2 className="font-display italic font-medium text-[1.5rem] mb-1.5">
            How was this built?
          </h2>
          <p className="font-serif text-[0.97rem] leading-[1.6] text-ink">
            I&apos;m constantly on the hunt for new mind-blowing albums, but I couldn&apos;t find a recommender where I give it an album I like and get back the <em>k</em> most similar albums. The song and artist recommenders I found all seemed to use user co-occurrence (how often two songs are played by the same person). That felt like cheating, since it builds similarity out of listeners&apos; habits instead of the music itself.
          </p>
          <p className="mt-3 font-serif text-[0.97rem] leading-[1.6] text-ink">
            So in my junior year of college I built recmyrecord, an album recommender that works from the music. Each album is a vector of <em>n</em> features: audio features like valence, danceability, and energy, plus music descriptors from rateyourmusic.com (RYM), weighted by how often users apply them. The albums come from RYM&apos;s top 5,000, and RYM is also where I track my listening and find new music (almost too often!).
          </p>
          <p className="mt-3 font-serif text-[0.97rem] leading-[1.6] text-ink">
            This map shows the albums from that set I&apos;ve rated. It uses t-SNE, a dimensionality reduction algorithm, to place albums with similar vectors close together in 2D and push dissimilar ones farther apart.
          </p>
        </div>
        <CrossLinkCard
          href="https://www.recmyrecord.com"
          external
          title="RecMyRecord"
          description="Give it an album you like and get the most similar ones back, using the same features as this map."
        />
      </div>
    </section>
  );
}
