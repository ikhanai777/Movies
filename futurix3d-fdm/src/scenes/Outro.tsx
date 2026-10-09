import React from "react";
import { Canvas } from "../components";
import { cue, sceneWindow } from "../timing";
import { C, FONT, clamp01, lerp, prog } from "../theme";
import { VASE, vaseFlat, vaseR, vaseY } from "../vase";
import { Nozzle } from "./Layers";

// Time-lapse of the vase building up layer by layer, a clean reveal, the
// FDM title card, then the hook's orange line draws the Futurix3D wordmark.
const N = 44;
const STRIP = (VASE.bottom - VASE.top) / N;

export const FINAL_START = 58.0; // last 2 s: wordmark draw

export const Outro: React.FC<{ t: number }> = ({ t }) => {
  const w = sceneWindow("outro");
  const tAppears = cue("outro", "appears");
  const tThats = cue("outro", "that's");
  const buildP = clamp01((t - (w.from + 0.15)) / (tAppears - 0.55 - w.from - 0.15));
  const layersDone = buildP * N;
  const solid = prog(t, tAppears - 0.45, 0.7);
  const nozOut = prog(t, tAppears - 0.6, 0.5);
  const title = prog(t, tThats - 0.2, 0.7);
  const clear = prog(t, FINAL_START - 0.35, 0.4);
  const vs = lerp(1, 0.6, title);
  const vt = `translate(540 ${lerp(VASE.top, 400, title)}) scale(${vs}) translate(-540 ${-VASE.top})`;

  // final wordmark draw
  const lead = prog(t, FINAL_START, 0.45);
  const trace = prog(t, FINAL_START + 0.25, 1.05);
  const fill = prog(t, FINAL_START + 0.95, 0.45);
  const follow = prog(t, FINAL_START + 1.05, 0.5);

  const topY = vaseY(VASE, buildP);
  const topR = vaseR(Math.min(1, buildP)) * VASE.rmax;

  return (
    <Canvas>
      <defs>
        <linearGradient id="vaseshade" x1={VASE.cx - VASE.rmax} x2={VASE.cx + VASE.rmax} y1={0} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.accent} />
          <stop offset="0.25" stopColor={C.accent} />
          <stop offset="0.42" stopColor={C.accentHot} />
          <stop offset="0.6" stopColor={C.accent} />
          <stop offset="1" stopColor={C.accent} />
        </linearGradient>
        <clipPath id="vaseclip"><path d={vaseFlat(VASE)} /></clipPath>
      </defs>
      <g opacity={1 - clear} transform={vt}>
        {/* layer strips (time-lapse) */}
        <g clipPath="url(#vaseclip)">
          {Array.from({ length: N }, (_, i) => {
            const f = clamp01(layersDone - i);
            if (f <= 0) return null;
            const y = VASE.bottom - (i + 1) * STRIP;
            const gap = lerp(3, 0, solid);
            return <rect key={i} x={VASE.cx - VASE.rmax} y={y + gap / 2} width={VASE.rmax * 2} height={STRIP - gap + 0.5} fill={C.accent} opacity={f} />;
          })}
          <rect x={VASE.cx - VASE.rmax} y={VASE.top} width={VASE.rmax * 2} height={VASE.bottom - VASE.top} fill="url(#vaseshade)" opacity={0.4 * solid} />
          {Array.from({ length: N }, (_, i) => (
            <line key={i} x1={VASE.cx - VASE.rmax} x2={VASE.cx + VASE.rmax} y1={VASE.bottom - i * STRIP} y2={VASE.bottom - i * STRIP} stroke={C.ink} strokeWidth={1} opacity={0.08 * solid} />
          ))}
        </g>
        {/* parked nozzle rises with the print, like a real time-lapse frame */}
        {nozOut < 1 && buildP > 0 && (
          <g opacity={1 - nozOut}>
            <Nozzle x={VASE.cx + topR + 70} tip={topY - 8} />
          </g>
        )}
      </g>

      {/* title card */}
      {title > 0 && (
        <g opacity={title * (1 - clear)} transform={`translate(0 ${(1 - title) * 30})`}>
          <text x={540} y={1035} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={176} letterSpacing={-4} fill={C.ink}>FDM</text>
          <text x={540} y={1112} textAnchor="middle" fontFamily={FONT} fontWeight={500} fontSize={46} fill={C.mid}>
            <tspan fill={C.ink} fontWeight={800}>F</tspan>used <tspan fill={C.ink} fontWeight={800}>D</tspan>eposition <tspan fill={C.ink} fontWeight={800}>M</tspan>odeling
          </text>
        </g>
      )}

      {/* final: the hook's orange line draws the wordmark */}
      {lead > 0 && (
        <g>
          <path d={`M-40 ${800} L${lerp(-40, 150, lead)} 800`} stroke={C.accent} strokeWidth={7} strokeLinecap="round" opacity={1 - fill} />
          <text x={540} y={852} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={158} letterSpacing={-5}
            fill="none" stroke={C.accent} strokeWidth={4} strokeLinejoin="round" strokeDasharray="700 700" strokeDashoffset={700 * (1 - trace)} opacity={1 - fill}>
            Futurix3D
          </text>
          <text x={540} y={852} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={158} letterSpacing={-5} fill={C.ink} opacity={fill}>
            Futurix<tspan fill={C.accent}>3D</tspan>
          </text>
          <text x={540} y={960} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={50} fill={C.mid} opacity={follow} transform={`translate(0 ${(1 - follow) * 14})`}>
            Follow for more
          </text>
        </g>
      )}
    </Canvas>
  );
};
