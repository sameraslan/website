import { MusicMapHero } from '@/components/music-map/MusicMapHero';
import { MusicMapCaption } from '@/components/music-map/MusicMapCaption';
import { siteConfig } from '@/lib/site-config';

export default function Home() {
  return (
    <section className="w-full flex flex-col justify-center min-h-[calc(100vh-12rem)]">
      <MusicMapHero />
      <MusicMapCaption text={siteConfig.tagline} exploreHref="/music" />
    </section>
  );
}
