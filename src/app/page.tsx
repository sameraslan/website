import { HomeHero } from '@/components/home/HomeHero';

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
        never download the desktop data payload (perf audit item 1g). This
        mirrors the `(max-width: 639px)` breakpoint used everywhere else in
        the music-map component.
      */}
      <link
        rel="preload"
        as="fetch"
        href="/data/positions.json"
        crossOrigin="anonymous"
        media="(min-width: 640px)"
      />
      <link
        rel="preload"
        as="fetch"
        href="/data/metadata.json"
        crossOrigin="anonymous"
        media="(min-width: 640px)"
      />
      <link
        rel="preload"
        as="fetch"
        href="/data/regions.json"
        crossOrigin="anonymous"
        media="(min-width: 640px)"
      />
      <HomeHero />
    </>
  );
}
