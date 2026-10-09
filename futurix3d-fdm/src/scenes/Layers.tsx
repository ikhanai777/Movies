import React from "react";
import { Arrow, Canvas, DrawPath, Label } from "../components";
import { cue, sceneWindow } from "../timing";
import { C, FONT, clamp01, ease, lerp, prog } from "../theme";

// Side view: layers stack up; the bed drops (or the nozzle rises) by one
// layer height; an inset shows two bead cross-sections bonding ONLY at their
// contact surface (partial re-melt), never the whole layer below.
const BED_Y = 1080, BED_L = 110, BED_R = 690;
const L = 190, R = 610, LH = 34;
const INSET = { x: 810, y: 560, r: 175 };

export const Nozzle: React.FC<{ x: number; tip: number; hot?: boolean }> = ({ x, tip }) => (
  <g>
    <rect x={x - 62} y={tip - 128} width={124} height={68} rx={12} fill={C.bg} stroke={C.ink} strokeWidth={4} />
    <path d={`M${x - 40} ${tip - 60} L${x - 9} ${tip} L${x + 9} ${tip} L${x + 40} ${tip - 60}`} fill={C.bg} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
    <line x1={x} y1={tip - 128} x2={x} y2={tip - 175} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
  </g>
);

const LayerBar: React.FC<{ k: number; base: number; x0: number; x1: number; hotX?: number; dir?: number }> = ({ k, base, x0, x1, hotX, dir = 1 }) => {
  if (x1 - x0 < 1) return null;
  const y = base - (k + 1) * LH + 2;
  const id = `hot${k}`;
  return (
    <g>
      {hotX !== undefined && (
        <defs>
          <linearGradient id={id} x1={hotX} x2={hotX - dir * 170} y1={0} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={C.accentHot} stopOpacity={1} />
            <stop offset="1" stopColor={C.accentHot} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <rect x={x0} y={y} width={x1 - x0} height={LH - 4} rx={(LH - 4) / 2} fill={C.accent} />
      {hotX !== undefined && <rect x={x0} y={y} width={x1 - x0} height={LH - 4} rx={(LH - 4) / 2} fill={`url(#${id})`} />}
    </g>
  );
};

export const Layers: React.FC<{ t: number }> = ({ t }) => {
  const w = sceneWindow("layers");
  const build = prog(t, w.from - 0.35, 0.35);
  const tDone = cue("layers", "done");
  const tBed = cue("layers", "bed");
  const tRise = cue("layers", "rises");
  const tFrac = cue("layers", "fraction");
  const tNext = cue("layers", "next");
  const tFuse = cue("layers", "fuses");
  const tTop = cue("layers", "top");

  // Z motion
  const drop = prog(t, tBed, 0.55);
  const rise = prog(t, tRise - 0.3, 0.55);
  const rise2 = prog(t, tTop + 0.75, 0.3);
  const bedShift = LH * drop * (1 - rise);
  const base = BED_Y + bedShift;

  // layer 5 (k=4): left->right until "done"; layer 6 (k=5): right->left from "next"; layer 7 (k=6) left->right
  const p4 = clamp01((t - (w.from - 0.2)) / (tDone - w.from + 0.2));
  const p5 = clamp01((t - (tNext - 0.1)) / (tTop + 0.65 - tNext + 0.1));
  const p6 = clamp01((t - (tTop + 1.1)) / (w.to - tTop - 1.1 + 0.3));
  const x4 = lerp(L, R, p4);
  const x5 = lerp(R, L, p5);
  const x6 = lerp(L, R, p6);
  let nx = x4;
  if (t >= tNext - 0.1) nx = x5;
  if (t >= tTop + 1.1) nx = x6;
  // nozzle tip height (absolute screen y)
  const tipLayer = 5 + rise + rise2; // number of layers below the tip
  const tip = BED_Y - tipLayer * LH;

  const inset = prog(t, tFrac - 0.2, 0.6);
  const fuse = prog(t, tFuse - 0.1, 0.6);
  const upperHot = prog(t, tNext, 0.4) * (1 - 0.6 * prog(t, tFuse + 0.8, 1.0));

  return (
    <Canvas>
      {/* Z axis */}
      <g opacity={build}>
        <Arrow x1={78} y1={BED_Y} x2={78} y2={BED_Y - 290} />
        <text x={78} y={BED_Y - 312} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={42} fill={C.ink}>Z</text>
      </g>

      {/* bed + stack (moves together) */}
      <g opacity={build}>
        <rect x={BED_L} y={base} width={BED_R - BED_L} height={26} rx={6} fill={C.faint} stroke={C.ink} strokeWidth={4} />
        {[0, 1, 2, 3].map((i) => <LayerBar key={i} k={i} base={base} x0={L} x1={R} />)}
        <LayerBar k={4} base={base} x0={L} x1={x4} hotX={t < tDone + 0.6 ? x4 : undefined} />
        {t >= tNext - 0.1 && <LayerBar k={5} base={base} x0={x5} x1={R} hotX={t < tTop + 1.3 ? x5 : undefined} dir={-1} />}
        {t >= tTop + 1.1 && <LayerBar k={6} base={base} x0={L} x1={x6} hotX={x6} />}
      </g>

      <g opacity={build}>
        <Nozzle x={nx} tip={tip} />
      </g>

      {/* Z-move labels */}
      {(() => {
        const a = prog(t, tBed - 0.1, 0.4) * (1 - prog(t, tRise - 0.3, 0.3));
        const b = prog(t, tRise - 0.3, 0.4) * (1 - prog(t, tFrac - 0.3, 0.3));
        return (
          <>
            {a > 0 && (
              <g opacity={a}>
                <text x={BED_R + 26} y={base + 24} fontFamily={FONT} fontWeight={800} fontSize={38} fill={C.ink}>Bed drops</text>
                <Arrow x1={BED_R + 264} y1={base - 10} x2={BED_R + 264} y2={base + 34} head={14} />
              </g>
            )}
            {b > 0 && (
              <g opacity={b}>
                <text x={nx + 84} y={tip - 84} fontFamily={FONT} fontWeight={800} fontSize={38} fill={C.ink}>Nozzle rises</text>
                <Arrow x1={nx + 84 + 250} y1={tip - 74} x2={nx + 84 + 250} y2={tip - 124} head={14} />
              </g>
            )}
          </>
        );
      })()}

      {/* magnifier + inset */}
      {inset > 0 && (
        <g opacity={inset}>
          <circle cx={R - 30} cy={BED_Y - 5 * LH} r={24} fill="none" stroke={C.ink} strokeWidth={3} />
          <DrawPath d={`M${R - 30 + 17} ${BED_Y - 5 * LH - 17} L${INSET.x - INSET.r * 0.72} ${INSET.y + INSET.r * 0.69}`} p={inset} stroke={C.mid} strokeWidth={3} strokeDasharray="1 0" />
          <g transform={`translate(${INSET.x} ${INSET.y}) scale(${lerp(0.85, 1, inset)}) translate(${-INSET.x} ${-INSET.y})`}>
            <clipPath id="insetclip"><circle cx={INSET.x} cy={INSET.y} r={INSET.r} /></clipPath>
            <circle cx={INSET.x} cy={INSET.y} r={INSET.r} fill="#FBFAF7" />
            <g clipPath="url(#insetclip)">
              {/* lower layer: three bead cross-sections */}
              {[-1, 0].map((i) => (
                <rect key={`l${i}`} x={INSET.x - 112 + i * 226} y={INSET.y + 18} width={224} height={92} rx={46} fill={C.accent} />
              ))}
              {/* upper layer bead just laid on top */}
              {prog(t, tNext - 0.2, 0.5) > 0 && [-1, 0].map((i) => (
                <g key={`u${i}`} opacity={prog(t, tNext - 0.2 + (i + 1) * 0.15, 0.4)}>
                  <rect x={INSET.x - 112 + i * 226} y={INSET.y - 72} width={224} height={92} rx={46} fill={C.accent} />
                  <rect x={INSET.x - 112 + i * 226} y={INSET.y - 72} width={224} height={92} rx={46} fill={C.accentHot} opacity={upperHot} />
                </g>
              ))}
              {/* contact surface re-melt (thin band only) */}
              {fuse > 0 && [-1, 0].map((i) => (
                <ellipse key={`f${i}`} cx={INSET.x + i * 226} cy={INSET.y + 19} rx={84 * fuse} ry={11} fill="#FFE2CF" filter="url(#glow)" opacity={fuse * (0.75 + 0.25 * Math.sin(t * 6) ** 2)} />
              ))}
              {/* layer height dimension */}
              {prog(t, tFrac, 0.4) > 0 && (
                <g opacity={prog(t, tFrac, 0.4)} stroke={C.ink} strokeWidth={3} strokeLinecap="round">
                  <line x1={INSET.x + 128} y1={INSET.y + 18} x2={INSET.x + 160} y2={INSET.y + 18} />
                  <line x1={INSET.x + 128} y1={INSET.y + 110} x2={INSET.x + 160} y2={INSET.y + 110} />
                  <line x1={INSET.x + 146} y1={INSET.y + 26} x2={INSET.x + 146} y2={INSET.y + 102} />
                </g>
              )}
            </g>
            <circle cx={INSET.x} cy={INSET.y} r={INSET.r} fill="none" stroke={C.ink} strokeWidth={4} />
          </g>
          <text x={INSET.x} y={INSET.y + INSET.r + 52} textAnchor="middle" fontFamily={FONT} fontWeight={500} fontSize={32} fill={C.mid}>Layer height</text>
          <text x={INSET.x} y={INSET.y + INSET.r + 96} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={38} fill={C.ink}>0.1–0.3 mm</text>
        </g>
      )}
      <Label x={560} y={430} ax={INSET.x - 60} ay={INSET.y + 19} align="end" title="Heat fuses" value="the contact surface" p={fuse} size={32} />
    </Canvas>
  );
};
