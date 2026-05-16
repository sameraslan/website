"use client";

import { useEffect, useRef } from "react";

import { useMapStore } from "../state/store";

export function Slider() {
  const sliderT = useMapStore((s) => s.sliderT);
  const setSliderT = useMapStore((s) => s.setSliderT);
  const trackRef = useRef<HTMLDivElement>(null);

  // Read prefers-reduced-motion + connection for the discrete-snap fallback
  const discreteOnly = useDiscreteSlider();

  useEffect(() => {
    if (!trackRef.current) return;
    const track = trackRef.current;
    let dragging = false;

    function setFromClient(clientX: number) {
      const rect = track.getBoundingClientRect();
      let t = (clientX - rect.left) / rect.width;
      t = Math.max(0, Math.min(1, t));
      if (discreteOnly) {
        // Snap to 0, 0.5, 1
        t = t < 0.25 ? 0 : t > 0.75 ? 1 : 0.5;
      }
      setSliderT(t);
    }

    function onDown(e: PointerEvent) {
      dragging = true;
      track.setPointerCapture(e.pointerId);
      setFromClient(e.clientX);
    }
    function onMove(e: PointerEvent) {
      if (dragging) setFromClient(e.clientX);
    }
    function onUp(e: PointerEvent) {
      dragging = false;
      try { track.releasePointerCapture(e.pointerId); } catch {}
    }

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
    };
  }, [setSliderT, discreteOnly]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        background: "rgba(246, 240, 225, 0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid #d8d0bd",
        borderRadius: 999,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 10,
        color: "#6b6852",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
      role="group"
      aria-label="Audio to mood slider"
    >
      <span>audio</span>
      <div
        ref={trackRef}
        style={{
          width: 110,
          height: 24,
          // Visual track is a thin bar; the surrounding 24px box widens the
          // pointer hit area so playwright (and human) drags don't have to
          // hit a 3-px line.
          background: "linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), #d8d0bd calc(50% - 1px), #d8d0bd calc(50% + 1px), transparent calc(50% + 1px))",
          position: "relative",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${sliderT * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 10,
            height: 10,
            borderRadius: 5,
            background: "#2d2a22",
            pointerEvents: "none",
          }}
        />
        {/* Keyboard / a11y handle. pointer-events disabled so the track div's
            pointer handlers (which run our store update logic) own all mouse
            and touch input. The native range input remains for screen readers
            and arrow-key navigation. */}
        <input
          type="range"
          min={0}
          max={1}
          step={discreteOnly ? 0.5 : 0.001}
          value={sliderT}
          onChange={(e) => setSliderT(parseFloat(e.target.value))}
          aria-label="Audio to mood projection"
          style={{
            position: "absolute",
            opacity: 0,
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>
      <span>mood</span>
    </div>
  );
}

function useDiscreteSlider(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  // @ts-expect-error: navigator.connection is non-standard
  const conn = navigator.connection;
  if (conn?.effectiveType && /slow-2g|2g/.test(conn.effectiveType)) return true;
  if (window.innerWidth < 768) return true; // mobile
  return false;
}
