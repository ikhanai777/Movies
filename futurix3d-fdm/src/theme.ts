import { Easing } from "remotion";

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const DURATION_S = 60;

// Instagram safe zone: nothing important above y=250 or below y=1520.
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = H - 400;

export const C = {
  bg: "#F5F3EE",
  ink: "#2A2A2A", // charcoal
  mid: "#7D7A73",
  soft: "#B9B5AC",
  faint: "#DEDAD1",
  accent: "#FF6B2C",
  accentHot: "#FFB38A", // brighter tint of the accent for "molten" glow
};

export const STROKE = 4;
export const FONT = "Inter";
export const MONO = "JetBrains Mono";

// Smooth ease-in-out used everywhere.
export const ease = Easing.bezier(0.45, 0, 0.25, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0..1 progress of t through [a, a+dur], eased. */
export const prog = (t: number, a: number, dur: number, fn = ease) =>
  fn(clamp01((t - a) / dur));

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
