import React from "react";
import { Canvas, Label } from "../components";
import { cue, sceneWindow } from "../timing";
import { C, FONT, clamp01, ease, lerp, prog } from "../theme";
import { Nozzle } from "./Layers";

// Side view. A fan cools each fresh line; an overhang printed over thin air
// sags, then is replayed on top of thin temporary support columns.
const BED_Y = 1080, LH = 30;
const P_L = 270, P_R = 470, O_R = 820; // pillar and overhang extents
const K = 9; // layer index being printed (pillar has 9 layers below)
const TOP = BED_Y - (K + 1) * LH; // nozzle tip / top of the current layer
const SUP_X = Array.from({ length: 12 }, (_, i) => P_R + 22 + i * 29);

const Fan: React.FC<{ x: number; y: number; ang: number; p: number }> = ({ x, y, ang, p }) => (
  <g opacity={p} transform={`translate(${x} ${y})`}>
    <rect x={-58} y={-58} width={116} height={116} rx={22} fill={C.bg} stroke={C.ink} strokeWidth={4} />
    <circle r={44} fill="none" stroke={C.soft} strokeWidth={3} />
    <g transform={`rotate(${ang})`}>
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 72})`} d="M0 -10 C 14 -18, 28 -26, 34 -12 C 26 -6, 14 -4, 8 4 Z" fill={C.ink} opacity={0.85} />
      ))}
      <circle r={10} fill={C.ink} />
    </g>
  </g>
);

export const Cooling: React.FC<{ t: number }> = ({ t }) => {
  const w = sceneWindow("cooling");
  const build = prog(t, w.from - 0.3, 0.5);
  const tFan = cue("cooling", "fan");
  const tShape = cue("cooling", "shape");
  const tSteep = cue("cooling", "steep");
  const tTemp = cue("cooling", "temporary");
  const tSup = cue("cooling", "supports");
  const tBecause = cue("cooling", "because");
  const tAir = cue("cooling", "air");

  // nozzle path (x) and extrusion state
  const a1 = clamp01((t - (w.from + 0.1)) / (tShape + 0.4 - w.from - 0.1)); // over pillar
  const a2 = prog(t, tSteep - 0.05, 1.1, (x) => x); // over thin air (sags)
  const back = prog(t, tSup - 0.15, 0.55); // rewind
  const a3 = clamp01((t - tBecause) / (tAir - tBecause)); // over supports
  let nx = lerp(P_L, P_R, a1);
  if (t >= tSteep - 0.05) nx = lerp(P_R, O_R, a2);
  if (t >= tSup - 0.15) nx = lerp(O_R, P_R, back);
  if (t >= tBecause) nx = lerp(P_R, O_R, a3);

  const fanOn = prog(t, tFan - 0.15, 0.6);
  const fanAng = Math.max(0, t - tFan + 0.2) * 900 * fanOn;
  const hotLen = lerp(220, 70, fanOn); // fan shortens the hot (soft) zone
  const sagGone = 1 - prog(t, tSup - 0.15, 0.4);
  const supP = prog(t, tSup - 0.35, 0.9);
  const supVis = supP > 0;
  const fanX = nx - 140, fanY = TOP - 175;

  // sagging strand beyond the pillar edge (unsupported attempt)
  const sagEnd = t >= tSteep - 0.05 && t < tSup - 0.15 ? nx : O_R;
  const sagPath = (() => {
    const pts: string[] = [];
    const n = 40;
    const tSag = clamp01((t - tSteep) / 1.4);
    for (let i = 0; i <= n; i++) {
      const x = P_R + (sagEnd - P_R) * (i / n);
      const d = Math.max(0, x - P_R);
      const age = Math.max(0, (sagEnd - x) / 360) + 0.15; // older plastic has sagged more
      const y = TOP + LH / 2 + Math.pow(d / 350, 1.6) * 230 * Math.min(1, age * 1.6) * (0.4 + 0.6 * tSag);
      pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  })();
  const sagVisible = t >= tSteep && sagGone > 0;
  const overX = t >= tBecause ? nx : P_R;

  return (
    <Canvas>
      <defs>
        <linearGradient id="coolhot" x1={nx} x2={nx - hotLen} y1={0} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.accentHot} stopOpacity={1} />
          <stop offset="1" stopColor={C.accentHot} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g opacity={build}>
        <rect x={170} y={BED_Y} width={780} height={26} rx={6} fill={C.faint} stroke={C.ink} strokeWidth={4} />
        {Array.from({ length: K }, (_, k) => (
          <rect key={k} x={P_L} y={BED_Y - (k + 1) * LH + 2} width={P_R - P_L} height={LH - 4} rx={(LH - 4) / 2} fill={C.accent} />
        ))}
      </g>

      {/* temporary supports */}
      {supVis && (
        <g>
          {SUP_X.map((x, i) => {
            const h = (BED_Y - TOP - 4) * clamp01(supP * 1.3 - i * 0.025);
            return <line key={i} x1={x} y1={BED_Y} x2={x} y2={BED_Y - h} stroke={C.accent} strokeWidth={6} strokeLinecap="round" opacity={0.5} />;
          })}
        </g>
      )}

      {/* current layer: over the pillar, then (a) sagging or (b) supported */}
      <rect x={P_L} y={TOP + 2} width={Math.max(0, Math.min(nx, P_R) - P_L)} height={LH - 4} rx={(LH - 4) / 2} fill={C.accent} />
      {sagVisible && (
        <path d={sagPath} fill="none" stroke={C.accent} strokeWidth={LH - 4} strokeLinecap="round" opacity={sagGone} />
      )}
      {overX > P_R && (
        <rect x={P_R - 20} y={TOP + 2} width={overX - P_R + 20} height={LH - 4} rx={(LH - 4) / 2} fill={C.accent} />
      )}
      {/* hot zone right behind the nozzle */}
      {(t < tSteep - 0.05 || t >= tBecause) && (
        <rect x={Math.max(P_L, nx - hotLen)} y={TOP + 2} width={Math.max(0, nx - Math.max(P_L, nx - hotLen))} height={LH - 4} rx={(LH - 4) / 2} fill="url(#coolhot)" />
      )}

      {/* airflow from fan to the fresh line */}
      {fanOn > 0 && [0, 1, 2].map((i) => {
        const sx = fanX + 40, sy = fanY + 30 + i * 12;
        const ex = nx - 30 - i * 40, ey = TOP - 2;
        const d = `M${sx} ${sy} C ${sx + 60} ${sy + 20}, ${ex - 40} ${ey - 50}, ${ex} ${ey}`;
        return (
          <path key={i} d={d} fill="none" stroke={C.mid} strokeWidth={3} strokeLinecap="round" strokeDasharray="14 22" strokeDashoffset={-t * 120 - i * 11} opacity={0.75 * fanOn} />
        );
      })}

      <g opacity={build}>
        <Nozzle x={nx} tip={TOP} />
      </g>
      <Fan x={fanX} y={fanY} ang={fanAng} p={build} />

      <Label x={fanX - 58} y={fanY - 92} title="Cooling fan" p={fanOn} />
      {(() => {
        const p = prog(t, tSteep + 0.6, 0.4) * sagGone;
        return p > 0 ? (
          <g opacity={p}>
            <text x={860} y={TOP + 70} fontFamily={FONT} fontWeight={500} fontSize={34} fill={C.mid}>No support:</text>
            <text x={860} y={TOP + 114} fontFamily={FONT} fontWeight={800} fontSize={38} fill={C.ink}>it sags</text>
          </g>
        ) : null;
      })()}
      <Label x={852} y={TOP + 200} ax={SUP_X[11]} ay={TOP + 190} title="Temporary" value="supports" p={prog(t, tSup - 0.1, 0.5)} />
    </Canvas>
  );
};
