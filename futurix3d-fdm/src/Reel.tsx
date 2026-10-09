import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { CornerWordmark, Captions, StepIndicator } from "./Overlays";
import { Hook } from "./scenes/Hook";
import { Slicing } from "./scenes/Slicing";
import { Extrusion } from "./scenes/Extrusion";
import { Motion } from "./scenes/Motion";
import { Layers } from "./scenes/Layers";
import { Cooling } from "./scenes/Cooling";
import { Outro } from "./scenes/Outro";
import { sfxCues } from "./sfx";
import { SceneId, TRANSITION, sceneWindow } from "./timing";
import { C, FPS, clamp01, ease, lerp } from "./theme";

type Tr =
  | { kind: "pullback" }
  | { kind: "zoom"; out: [number, number]; in: [number, number] }
  | { kind: "wipe" }
  | { kind: "pan" };

// Transition INTO each scene (centred on the scene boundary).
const TRANSITIONS: Partial<Record<SceneId, Tr>> = {
  slicing: { kind: "pullback" },
  extrusion: { kind: "zoom", out: [790, 640], in: [540, 740] }, // zoom into the toolpath
  motion: { kind: "zoom", out: [540, 1030], in: [540, 800] }, // zoom into the nozzle tip
  layers: { kind: "wipe" },
  cooling: { kind: "pan" },
  outro: { kind: "pullback" },
};

const SCENES: { id: SceneId; C: React.FC<{ t: number }> }[] = [
  { id: "hook", C: Hook },
  { id: "slicing", C: Slicing },
  { id: "extrusion", C: Extrusion },
  { id: "motion", C: Motion },
  { id: "layers", C: Layers },
  { id: "cooling", C: Cooling },
  { id: "outro", C: Outro },
];

const about = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) scale(${s}) translate(${-x}px, ${-y}px)`;

/** Style for a scene given its role in a transition (p: 0..1 eased). */
const trStyle = (tr: Tr, role: "in" | "out", p: number): React.CSSProperties => {
  switch (tr.kind) {
    case "pullback":
      return role === "out"
        ? { opacity: 1 - p, transform: about(540, 800, lerp(1, 0.6, p)) }
        : { opacity: p, transform: about(540, 800, lerp(1.25, 1, p)) };
    case "zoom":
      return role === "out"
        ? { opacity: clamp01(1 - p * 1.6), transform: about(tr.out[0], tr.out[1], lerp(1, 3.2, p)) }
        : { opacity: clamp01(p * 1.6 - 0.4), transform: about(tr.in[0], tr.in[1], lerp(0.45, 1, p)) };
    case "wipe":
      return role === "out" ? { opacity: p >= 1 ? 0 : 1 } : { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    case "pan":
      return role === "out"
        ? { opacity: 1 - p, transform: `translateX(${-p * 620}px)` }
        : { opacity: p, transform: `translateX(${(1 - p) * 620}px)` };
  }
};

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const half = TRANSITION / 2;
  const sfx = sfxCues();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {SCENES.map(({ id, C: Scene }, i) => {
        const win = sceneWindow(id);
        if (t < win.from - half || t >= win.to + half) return null;
        const style: React.CSSProperties = { position: "absolute", inset: 0 };
        let wipeEdge: number | null = null;
        const trIn = TRANSITIONS[id];
        if (trIn && t < win.from + half) {
          const p = ease(clamp01((t - (win.from - half)) / TRANSITION));
          Object.assign(style, trStyle(trIn, "in", p));
          if (trIn.kind === "wipe") wipeEdge = p;
        }
        const next = SCENES[i + 1];
        const trOut = next && TRANSITIONS[next.id];
        if (trOut && t >= win.to - half) {
          const p = ease(clamp01((t - (win.to - half)) / TRANSITION));
          Object.assign(style, trStyle(trOut, "out", p));
        }
        return (
          <React.Fragment key={id}>
            <div style={{ ...style, zIndex: i, background: trIn?.kind === "wipe" && wipeEdge !== null ? C.bg : undefined }}>
              <Scene t={t} />
            </div>
            {wipeEdge !== null && wipeEdge > 0 && wipeEdge < 1 && (
              <div style={{ position: "absolute", top: 380, bottom: 700, left: wipeEdge * 1080 - 2, width: 4, borderRadius: 2, background: C.ink, opacity: Math.sin(wipeEdge * Math.PI), zIndex: 20 }} />
            )}
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
        <StepIndicator t={t} />
        <Captions t={t} />
        <CornerWordmark />
      </div>

      {/* audio: VO + quiet music bed + subtle sfx */}
      <Audio src={staticFile("audio/vo.wav")} />
      <Audio src={staticFile("audio/music.wav")} volume={1} />
      {sfx.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.t * FPS))} durationInFrames={45}>
          <Audio src={staticFile(`audio/${s.kind}.wav`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
