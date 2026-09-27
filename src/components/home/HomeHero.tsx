import MusicMapClient from "@/components/music-map/MusicMapClient";
import { NARROW_MEDIA_QUERY } from "@/components/music-map/state/breakpoints";

import { HeroCaption } from "./HeroCaption";

/**
 * Full-bleed home hero (Option B): the music map fills the viewport below
 * the (overlaid) header, edge to edge, with the caption card floating
 * bottom-left. The map's own overlays (slider, search) sit bottom-right.
 *
 * Below 640px (spec 4.7 / Task 11) this collapses to the "Home · phone"
 * artboard: the map drops out of the absolute stack into normal flow at a
 * fixed 390px tall, directly under the (now non-overlaid, see SiteHeader)
 * header, with the caption content flowing below it rather than floating on
 * top.
 */
export function HomeHero() {
  return (
    <section
      className="home-hero"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 560,
        overflow: "hidden",
      }}
    >
      <style>{`
        @media ${NARROW_MEDIA_QUERY} {
          .home-hero {
            height: auto;
            min-height: 0;
            overflow: visible;
          }
          .home-hero-map {
            position: static !important;
            height: 390px !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="home-hero-map" style={{ position: "absolute", inset: 0 }}>
        <MusicMapClient />
      </div>
      <HeroCaption />
    </section>
  );
}
