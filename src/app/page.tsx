import { HomeHero } from '@/components/home/HomeHero';
import { NOT_NARROW_MEDIA_QUERY } from '@/components/music-map/state/breakpoints';

export default function Home() {
  return (
    <>
      {/*
        Preload the music map's data files so the browser starts fetching
        them from the HTML parse, overlapping the JS bundle download instead
        of waiting behind it (perf audit item 1a). `crossOrigin="anonymous"`
        must match the fetch's credentials mode (loader.ts uses "same-origin")
        for the preload to be reused rather than duplicated.

        `media` gates the preload itself: the browser only fetches a preload
        link when its media query matches at parse time, so phones (which
        don't mount the real map yet, see MusicMap.tsx's isNarrow branch)
        never download the desktop data payload (perf audit item 1g).
        NOT_NARROW_MEDIA_QUERY mirrors NARROW_MEDIA_QUERY (both in
        state/breakpoints.ts) so this stays in sync with the breakpoint used
        everywhere else in the music-map component.
      */}
      <link
        rel="preload"
        as="fetch"
        href="/data/positions.json"
        crossOrigin="anonymous"
        media={NOT_NARROW_MEDIA_QUERY}
      />
      <link
        rel="preload"
        as="fetch"
        href="/data/metadata.json"
        crossOrigin="anonymous"
        media={NOT_NARROW_MEDIA_QUERY}
      />
      <link
        rel="preload"
        as="fetch"
        href="/data/regions.json"
        crossOrigin="anonymous"
        media={NOT_NARROW_MEDIA_QUERY}
      />
      <HomeHero />
    </>
  );
}
