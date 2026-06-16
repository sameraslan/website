"use client";

import { useEffect, useState } from "react";

import {
  type AnimMode,
  type TuningParams,
  PRESETS,
  useTuningStore,
} from "../state/tuning";

const MODES: { id: AnimMode; label: string; hint: string }[] = [
  {
    id: "near-focus",
    label: "near-focus",
    hint: "stay zoomed in, drift around, focus a nearby album every few seconds",
  },
  {
    id: "free-wander",
    label: "free-wander",
    hint: "drift only, no auto-focus snaps",
  },
  {
    id: "slow-tour",
    label: "slow-tour",
    hint: "glide slowly between random albums across the whole map, no zoom-in",
  },
  {
    id: "pan-loop",
    label: "pan-loop",
    hint: "smooth circular orbit around the center, no auto-focus",
  },
];

interface SliderSpec {
  key: keyof TuningParams;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
}

const NUMERIC_SLIDERS: SliderSpec[] = [
  { key: "driftAmplitude", label: "drift amplitude (world)", min: 0, max: 1.0, step: 0.01 },
  { key: "driftFreqHz", label: "drift freq (Hz)", min: 0.005, max: 0.2, step: 0.001, fmt: (v) => `${v.toFixed(3)} (${(1 / v).toFixed(0)}s loop)` },
  { key: "driftIdleDelayMs", label: "drift idle delay (ms)", min: 0, max: 8_000, step: 100 },
  { key: "orbitRadius", label: "orbit radius (world)", min: 0, max: 1.0, step: 0.01 },
  { key: "orbitFreqHz", label: "orbit freq (Hz)", min: 0.002, max: 0.1, step: 0.001, fmt: (v) => `${v.toFixed(3)} (${(1 / v).toFixed(0)}s loop)` },
  { key: "tourIdleDelayMs", label: "tour idle delay (ms)", min: 0, max: 15_000, step: 100 },
  { key: "tourHoldMs", label: "tour hold (ms)", min: 500, max: 10_000, step: 100 },
  { key: "tourPauseMs", label: "tour pause (ms)", min: 0, max: 15_000, step: 100 },
  { key: "tourNearbyRadius", label: "tour nearby radius (world)", min: 0.05, max: 1.5, step: 0.01 },
  { key: "overviewZoom", label: "overview zoom", min: 0.5, max: 5.0, step: 0.05 },
  { key: "focusZoom", label: "focus zoom", min: 0.5, max: 5.0, step: 0.05 },
  { key: "focusFlyDurationMs", label: "fly duration (ms)", min: 200, max: 8_000, step: 50 },
  { key: "focusReleaseDurationMs", label: "release duration (ms)", min: 200, max: 4_000, step: 50 },
];

const BOOL_TOGGLES: { key: keyof TuningParams; label: string }[] = [
  { key: "orbitEnabled", label: "orbit enabled" },
  { key: "tourEnabled", label: "tour enabled" },
  { key: "tourNearbyOnly", label: "tour picks nearby" },
];

export function TuneHud() {
  const hudOpen = useTuningStore((s) => s.hudOpen);
  const setHudOpen = useTuningStore((s) => s.setHudOpen);
  const mode = useTuningStore((s) => s.mode);
  const setMode = useTuningStore((s) => s.setMode);
  const setParam = useTuningStore((s) => s.setParam);
  const resetToMode = useTuningStore((s) => s.resetToMode);
  const state = useTuningStore();
  const [copied, setCopied] = useState(false);
  const [enabledByUrl, setEnabledByUrl] = useState(false);

  // Toggle with ⇧T (so a stray T while typing in the search field doesn't open
  // the panel) or via ?tune=1 in the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tuneOn = params.get("tune") === "1";
    setEnabledByUrl(tuneOn);
    if (tuneOn) setHudOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "T" || e.key === "t")) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        setHudOpen(!useTuningStore.getState().hudOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setHudOpen]);

  if (!enabledByUrl && !hudOpen) return null;

  const copySnapshot = () => {
    const snap = {
      mode,
      params: Object.fromEntries(
        (Object.keys(PRESETS["near-focus"]) as (keyof TuningParams)[]).map((k) => [
          k,
          state[k],
        ]),
      ),
    };
    navigator.clipboard
      .writeText(JSON.stringify(snap, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 40,
        width: 320,
        maxHeight: "calc(100% - 24px)",
        overflowY: "auto",
        padding: "12px 14px",
        background: "rgba(250, 246, 236, 0.97)",
        border: "1px solid #231d14",
        borderRadius: 4,
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 11,
        color: "#231d14",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 12 }}>music map tune (⇧T)</strong>
        <button
          type="button"
          onClick={() => setHudOpen(false)}
          style={hudButtonStyle()}
        >
          close
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>mode</div>
        {MODES.map((m) => (
          <label key={m.id} style={{ display: "block", marginBottom: 3, cursor: "pointer" }}>
            <input
              type="radio"
              name="anim-mode"
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              style={{ marginRight: 6 }}
            />
            <span style={{ fontWeight: mode === m.id ? 700 : 400 }}>{m.label}</span>
            <div style={{ marginLeft: 18, color: "#5a5042", fontSize: 10, lineHeight: 1.3 }}>
              {m.hint}
            </div>
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        {BOOL_TOGGLES.map((b) => (
          <label key={b.key} style={{ display: "block", marginBottom: 3, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={Boolean(state[b.key])}
              onChange={(e) => setParam(b.key, e.target.checked as never)}
              style={{ marginRight: 6 }}
            />
            {b.label}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {NUMERIC_SLIDERS.map((s) => {
          const value = Number(state[s.key]);
          const display = s.fmt ? s.fmt(value) : value >= 100 ? value.toFixed(0) : value.toFixed(2);
          return (
            <div key={s.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>{s.label}</span>
                <span style={{ color: "#5a5042" }}>{display}</span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={value}
                onChange={(e) => setParam(s.key, Number(e.target.value) as never)}
                style={{ width: "100%" }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button type="button" onClick={resetToMode} style={hudButtonStyle()}>
          reset to mode defaults
        </button>
        <button type="button" onClick={copySnapshot} style={hudButtonStyle()}>
          {copied ? "copied!" : "copy JSON"}
        </button>
      </div>
    </div>
  );
}

function hudButtonStyle(): React.CSSProperties {
  return {
    padding: "4px 8px",
    background: "#faf6ec",
    border: "1px solid #231d14",
    borderRadius: 3,
    fontFamily: "inherit",
    fontSize: 11,
    color: "#231d14",
    cursor: "pointer",
  };
}
