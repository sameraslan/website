import { NARROW_MEDIA_QUERY } from "@/components/music-map/state/breakpoints";

/**
 * Caption card for the home hero (Option B). Sits bottom-left over the music
 * map on desktop. Below 640px (spec 4.7 / Task 11) it drops the card chrome
 * entirely (no background, no border) and renders as plain content in
 * normal flow below the map, padded like the rest of the site's pages
 * rather than like a floating card.
 */
export function HeroCaption() {
  return (
    <div
      className="hero-caption"
      style={{
        position: "absolute",
        left: 48,
        bottom: 40,
        width: 380,
        padding: "22px 24px 20px",
        background: "color-mix(in srgb, var(--color-paper-soft) 92%, transparent)",
        border: "1px solid var(--color-rule)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 10,
      }}
    >
      <style>{`
        @media ${NARROW_MEDIA_QUERY} {
          .hero-caption {
            position: static !important;
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 28px 24px 40px !important;
            background: none !important;
            border: none !important;
          }
        }
      `}</style>
      <h1 className="font-display font-normal text-[27px] leading-[1.2]">
        Machine learning engineer currently working at the intersection of AI and law.
      </h1>
      <p className="font-serif text-[15.5px] leading-[1.5] text-ink">
        Here&apos;s an evolving map of what I listen to.
      </p>
      <p className="font-mono text-tiny uppercase text-ink-muted">
        <span className="sm:hidden">tap a point · pinch to zoom</span>
        <span className="hidden sm:block">hover to read · click for neighbours</span>
        <span className="hidden sm:block">scroll to zoom · drag to pan</span>
      </p>
    </div>
  );
}
