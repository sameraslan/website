/**
 * Caption card for the home hero (Option B). Sits bottom-left over the music
 * map on desktop; collapses to static, full-width flow below 640px (rough
 * for now — Task 11 refines mobile layout).
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
        background: "rgba(253, 250, 242, 0.92)",
        border: "1px solid rgba(35, 29, 20, 0.16)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 10,
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .hero-caption {
            position: static !important;
            width: auto !important;
          }
        }
      `}</style>
      <h1 className="font-display font-normal text-[27px] leading-[1.2]">
        Machine learning engineer working at the intersection of AI and law.
      </h1>
      <p className="font-serif text-[15.5px] leading-[1.5] text-ink">
        Here&apos;s an evolving map of what I listen to.
      </p>
      <p className="font-mono text-tiny uppercase text-ink-muted">
        hover to read · click for neighbours · scroll to zoom
      </p>
    </div>
  );
}
