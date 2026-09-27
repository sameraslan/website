import ReactDOM from 'react-dom';

import { HomeHero } from '@/components/home/HomeHero';

export default function Home() {
  // Preload the music map's data files so the browser starts fetching them
  // from the HTML parse, overlapping the JS bundle download instead of
  // waiting behind it (perf audit item 1a). `crossOrigin: "anonymous"` must
  // match the fetch's credentials mode (loader.ts uses "same-origin") for
  // the preload to be reused rather than duplicated.
  //
  // Phones now mount the real map too (Task 11), so all screen sizes need
  // this payload; there is no `media` gate. `ReactDOM.preload` is React's
  // resource API rather than a raw `<link>` tag: React de-duplicates by
  // href across renders, so re-rendering this component on a client
  // navigation back to `/` does not emit a second `<link rel="preload">`
  // or re-trigger the browser fetch.
  ReactDOM.preload('/data/positions.json', { as: 'fetch', crossOrigin: 'anonymous' });
  ReactDOM.preload('/data/metadata.json', { as: 'fetch', crossOrigin: 'anonymous' });
  ReactDOM.preload('/data/regions.json', { as: 'fetch', crossOrigin: 'anonymous' });

  return <HomeHero />;
}
