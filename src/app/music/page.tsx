import MusicMapClient from '@/components/music-map/MusicMapClient';
import { CrossLinkCard } from '@/components/content/CrossLinkCard';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'music — samer aslan' };

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
            I'm constantly on the hunt for new mind-blowing albums, but I couldn't find an album recommender where, given an album I like, I get the <em>k</em> most similar albums to listen to. There were some song or artist recommenders out there, but they all seemed to use user co-occurrence (how often two songs are listened to by the same person). This felt like cheating, since we're looking at user data to create similarity between the music, rather than at the music itself. This prompted me to build recmyrecord in my junior year of college, an album recommender system that uses real audio features like valence, danceability, and energy, as well as music descriptors, to create similarity between albums. Each album is a vector of <em>n</em> features, each of which represents an audio feature or music description, where the music descriptions are weighted by frequency of user selection in rateyourmusic.com, a website I use to track my music listening and find new music (almost too often!). The albums themselves come from the top 5,000 albums on rateyourmusic. This map is a visual display of these audio vectors: I use t-SNE, a dimensionality reduction algorithm, to place albums with similar vectors close to one another in 2D space, and albums with different vectors further apart.
          </p>
        </div>
        <CrossLinkCard
          href="https://www.recmyrecord.com"
          external
          title="RecMyRecord"
          description="The album recommender version of this map, built as a fun project in college."
        />
      </div>
    </section>
  );
}
