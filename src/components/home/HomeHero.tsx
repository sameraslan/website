import MusicMapClient from "@/components/music-map/MusicMapClient";

import { HeroCaption } from "./HeroCaption";

/**
 * Full-bleed home hero (Option B): the music map fills the viewport below
 * the (overlaid) header, edge to edge, with the caption card floating
 * bottom-left. The map's own overlays (slider, search) sit bottom-right.
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
      {/* Below 640px the map area drops out of the absolute stack and into
          normal flow (MobileFallback sizes itself), so the caption below it
          isn't clipped by the fixed 100vh hero height. Rough for now; Task 11
          refines mobile layout. */}
      <style>{`
        @media (max-width: 640px) {
          .home-hero {
            height: auto;
            min-height: 0;
            overflow: visible;
          }
          .home-hero-map {
            position: static !important;
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
