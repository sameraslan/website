import { loadListening } from '@/lib/music-data';
import { MusicMapHero } from '@/components/music-map/MusicMapHero';
import { MusicMapCaption } from '@/components/music-map/MusicMapCaption';
import { siteConfig } from '@/lib/site-config';

export default async function Home() {
  const data = await loadListening();
  return (
    <section className="w-full">
      <MusicMapHero data={data} />
      <MusicMapCaption text={siteConfig.tagline} />
    </section>
  );
}
