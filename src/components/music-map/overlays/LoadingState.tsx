"use client";

export function LoadingState() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: "#231d14",
          animation: "music-map-pulse 1.6s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes music-map-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          50%  { transform: scale(2.4); opacity: 0.3; }
          100% { transform: scale(1);   opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
