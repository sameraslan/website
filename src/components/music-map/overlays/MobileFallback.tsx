"use client";

export function MobileFallback() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "50vh",
        background:
          "url(/images/music-map-static.webp) center/cover no-repeat, #f6f0e1",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 16px",
          background:
            "linear-gradient(180deg, rgba(246,240,225,0) 0%, rgba(246,240,225,0.95) 100%)",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12,
          color: "#6b6852",
          textAlign: "center",
        }}
      >
        the music map is best experienced on desktop
      </div>
    </div>
  );
}
