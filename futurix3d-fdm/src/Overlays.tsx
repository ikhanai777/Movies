import React from "react";
import { buildChunks } from "./captions";
import { scenes, sceneWindow, SceneId } from "./timing";
import { C, FONT, SAFE_BOTTOM, clamp01, ease, easeOut, prog } from "./theme";

const chunks = buildChunks();
// The end card spells out "Futurix3D / Follow for more" itself, so captions
// step aside for it instead of repeating the same words underneath.
export const CAPTIONS_END = 58.0;

// Caption block: vertically centred on y=1335, clear of the wordmark below.
export const CAPTION_Y = 1335;
export const CAPTION_SIZE = 62;
export const CAPTION_MAX_W = 940;

let measureCtx: CanvasRenderingContext2D | null = null;
const measure = (text: string, weight: number) => {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx!.font = `${weight} ${CAPTION_SIZE}px Inter`;
  return measureCtx!.measureText(text).width;
};

export const Captions: React.FC<{ t: number }> = ({ t }) => {
  const i = chunks.findIndex((ch) => t >= ch.start && t < ch.end);
  if (i < 0) return null;
  const c = chunks[i];
  const prev = chunks[i - 1];
  const next = chunks[i + 1];
  const chained = (a?: { end: number }, b?: { start: number }) => !!a && !!b && b.start - a.end < 0.05;
  // back-to-back chunks swap with a short rise instead of dipping to black
  const inP = chained(prev, c) ? 0.55 + 0.45 * prog(t, c.start, 0.12, easeOut) : prog(t, c.start, 0.22, easeOut);
  const outP = chained(c, next) ? 1 : clamp01((c.end - t) / 0.12);
  const endCard = 1 - prog(t, CAPTIONS_END - 0.3, 0.3);
  // Width guard: shrink rather than ever overflow the safe width.
  const width = c.words.reduce((a, w) => a + measure(w.text + " ", w.key ? 800 : 600), 0);
  const fit = Math.min(1, CAPTION_MAX_W / width);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: CAPTION_Y - CAPTION_SIZE * 0.7,
        display: "flex",
        justifyContent: "center",
        fontFamily: FONT,
        fontSize: CAPTION_SIZE,
        letterSpacing: -0.5,
        whiteSpace: "nowrap",
        opacity: Math.min(inP, outP, endCard),
        transform: `translateY(${(1 - inP) * 18}px) scale(${fit})`,
      }}
      data-caption-width={width.toFixed(0)}
    >
      {c.words.map((w, i) => {
        const spoken = t >= w.s - 0.05;
        const pw = prog(t, w.s - 0.05, 0.14);
        return (
          <span
            key={i}
            style={{
              marginRight: i < c.words.length - 1 ? "0.26em" : 0,
              fontWeight: w.key ? 800 : 600,
              color: w.key ? C.accent : C.ink,
              opacity: spoken ? 0.4 + 0.6 * pw : 0.4,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Wordmark text: "Futurix" in charcoal, "3D" in the accent. */
export const WordmarkText: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, letterSpacing: -0.02 * size, color: C.ink, ...style }}>
    Futurix<span style={{ color: C.accent }}>3D</span>
  </span>
);

// Bottom-right, inside the safe zone (bottom of glyphs ~y=1490 < 1520).
export const CornerWordmark: React.FC = () => (
  <div style={{ position: "absolute", right: 64, top: SAFE_BOTTOM - 74, opacity: 0.4, lineHeight: 1 }}>
    <WordmarkText size={40} />
  </div>
);

const STEPS: { id: SceneId; label: string }[] = [
  { id: "slicing", label: "Slicing" },
  { id: "extrusion", label: "Extrusion" },
  { id: "motion", label: "Motion" },
  { id: "layers", label: "Layers" },
  { id: "cooling", label: "Cooling & supports" },
];

/** Small step indicator at the top of the safe area (y≈290–350). */
export const StepIndicator: React.FC<{ t: number }> = ({ t }) => {
  const first = sceneWindow("slicing").from;
  const last = sceneWindow("cooling").to;
  const vis = Math.min(prog(t, first - 0.1, 0.5), 1 - prog(t, last - 0.3, 0.4));
  if (vis <= 0) return null;
  const idx = STEPS.findIndex((s) => {
    const w = sceneWindow(s.id);
    return t >= w.from && t < w.to;
  });
  const cur = Math.max(0, idx);
  return (
    <div style={{ position: "absolute", top: 292, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: vis }}>
      <div style={{ display: "flex", gap: 12 }}>
        {STEPS.map((s, i) => {
          const w = sceneWindow(s.id);
          const on = prog(t, w.from - 0.15, 0.35);
          const active = i === cur;
          return (
            <div key={s.id} style={{ width: active ? 64 : 36, height: 6, borderRadius: 3, background: i <= cur ? C.ink : C.faint, opacity: i < cur ? 0.45 : 1, transition: "none", transform: `scaleX(${i === cur ? 0.6 + 0.4 * on : 1})` }} />
          );
        })}
      </div>
      <div style={{ marginTop: 22, fontFamily: FONT, fontWeight: 600, fontSize: 30, letterSpacing: 5, color: C.mid, textTransform: "uppercase", position: "relative", height: 40, width: 800 }}>
        {STEPS.map((s, i) => {
          const w = sceneWindow(s.id);
          // old label fully out before the new one comes in (no overlapping text)
          const p = Math.min(prog(t, w.from, 0.3), 1 - prog(t, w.to - 0.28, 0.25));
          if (p <= 0) return null;
          return (
            <div key={s.id} style={{ position: "absolute", inset: 0, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
              <span style={{ color: C.ink, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ margin: "0 14px" }}>·</span>
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { scenes, ease };
