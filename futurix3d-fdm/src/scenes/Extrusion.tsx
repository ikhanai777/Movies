import React from "react";
import { Canvas, DrawPath, Label, Pt, polyD } from "../components";
import { cue, sceneWindow } from "../timing";
import { C, clamp01, lerp, prog } from "../theme";

// Vertical cross-section of an extruder + hot end (not to scale, but the
// proportions read correctly: filament 1.75 mm >> nozzle orifice 0.4 mm).
const X = 540;
const FW = 13; // filament half-width (26 px ≙ 1.75 mm)
const F_TOP = 380;
const GEAR_Y = 500, GEAR_R = 56, GEAR_DX = FW + 49;
const SINK_TOP = 585, SINK_BOT = 725;
const BLOCK_TOP = 750, BLOCK_BOT = 885, BLOCK_L = 410, BLOCK_R = 672;
const HEX_BOT = 918, TIP_Y = 990, ORIFICE = 5;
const BED_Y = 1010;
export const SHIFT = 40; // whole diagram sits 40 px lower
export const NOZZLE_TIP: Pt = [X, TIP_Y + SHIFT];

const gearD = (r: number, teeth: number) => {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * 2 * Math.PI;
    const s = (2 * Math.PI) / teeth;
    const ro = r, rr = r - 10;
    for (const [da, rad] of [[0, rr], [0.18, ro], [0.5, ro], [0.68, rr]] as const)
      pts.push([rad * Math.cos(a + da * s), rad * Math.sin(a + da * s)]);
  }
  return polyD(pts, true);
};
const GEAR_D = gearD(GEAR_R, 16);

const BORE: Pt[] = [
  [X - FW - 2, BLOCK_TOP - 30], [X - FW - 2, HEX_BOT - 6], [X - ORIFICE, TIP_Y],
  [X + ORIFICE, TIP_Y], [X + FW + 2, HEX_BOT - 6], [X + FW + 2, BLOCK_TOP - 30],
];

export const Extrusion: React.FC<{ t: number }> = ({ t }) => {
  const w = sceneWindow("extrusion");
  const build = prog(t, w.from - 0.3, 0.7);
  const tFeed = cue("extrusion", "feeds");
  const tHot = cue("extrusion", "hot");
  const tGears = cue("extrusion", "drive");
  const tPush = cue("extrusion", "push");
  const tHeater = cue("extrusion", "heater");
  const tMelt = cue("extrusion", "melts");
  const t200 = cue("extrusion", "two");
  const tNoz = cue("extrusion", "nozzle");
  const t04 = cue("extrusion", "zero");
  const tSq = cue("extrusion", "squeezes");

  // filament travel (px): slide-in, then continuous drive once pushed
  const slide = prog(t, tFeed - 0.1, 1.0);
  const tipY = lerp(F_TOP - 10, BLOCK_TOP - 30, slide);
  // constant feed once the gears push (eased start over the first 0.5 s)
  const dt = Math.max(0, t - tPush);
  const drive = 55 * (dt < 0.5 ? (dt * dt) / 1.0 : dt - 0.25);
  const disp = slide * (BLOCK_TOP - 30 - F_TOP) + drive;
  const gearAng = (disp / GEAR_R) * (180 / Math.PI);
  const gearsHi = prog(t, tGears - 0.1, 0.5);
  const heat = prog(t, tHeater - 0.1, 1.2);
  const melt = prog(t, tMelt, 1.2);
  const nozHi = prog(t, tNoz - 0.1, 0.5);
  const bead = Math.max(0, t - (tSq - 0.25)) * 170;
  const beadL = Math.min(bead, 330);

  return (
    <Canvas>
      <g transform={`translate(0 ${SHIFT})`}>
      <defs>
        <linearGradient id="meltgrad" x1="0" y1={BLOCK_TOP - 10} x2="0" y2={BLOCK_TOP + 80} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.accentHot} stopOpacity={0} />
          <stop offset="1" stopColor={C.accentHot} stopOpacity={1} />
        </linearGradient>
        <linearGradient id="beadgrad" x1={X} y1="0" x2={X - 150} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.accentHot} stopOpacity={1} />
          <stop offset="1" stopColor={C.accentHot} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="topfade" x1="0" y1={F_TOP - 10} x2="0" y2={F_TOP + 50} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.bg} stopOpacity={1} />
          <stop offset="1" stopColor={C.bg} stopOpacity={0} />
        </linearGradient>
        <clipPath id="filclip">
          <rect x={X - FW} y={F_TOP - 20} width={FW * 2} height={tipY - F_TOP + 20} rx={0} />
        </clipPath>
      </defs>

      {/* bed */}
      <g opacity={build}>
        <rect x={160} y={BED_Y} width={760} height={22} rx={6} fill={C.faint} stroke={C.ink} strokeWidth={4} />
        {Array.from({ length: 16 }, (_, i) => {
          const x = 180 + ((i * 50 - bead * 0.999) % 760 + 760) % 760;
          return x < 900 ? <line key={i} x1={x} y1={BED_Y + 8} x2={x + 14} y2={BED_Y + 8} stroke={C.soft} strokeWidth={3} strokeLinecap="round" /> : null;
        })}
      </g>

      {/* heat sink fins + heat break */}
      <g opacity={build}>
        {Array.from({ length: 5 }, (_, i) => (
          <rect key={i} x={X - 105} y={SINK_TOP + i * 29} width={210} height={13} rx={6.5} fill="none" stroke={C.soft} strokeWidth={3} />
        ))}
        <line x1={X - FW - 6} y1={SINK_TOP - 18} x2={X - FW - 6} y2={BLOCK_TOP} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
        <line x1={X + FW + 6} y1={SINK_TOP - 18} x2={X + FW + 6} y2={BLOCK_TOP} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
      </g>

      {/* heat block (glows as it heats) */}
      <g opacity={build}>
        <rect x={BLOCK_L - 10} y={BLOCK_TOP - 10} width={BLOCK_R - BLOCK_L + 20} height={BLOCK_BOT - BLOCK_TOP + 20} rx={24} fill={C.accent} opacity={0.45 * heat} filter="url(#softglow)" />
        <rect x={BLOCK_L} y={BLOCK_TOP} width={BLOCK_R - BLOCK_L} height={BLOCK_BOT - BLOCK_TOP} rx={14} fill={C.bg} stroke={C.ink} strokeWidth={4} />
        <rect x={BLOCK_L} y={BLOCK_TOP} width={BLOCK_R - BLOCK_L} height={BLOCK_BOT - BLOCK_TOP} rx={14} fill={C.accent} opacity={0.14 * heat} />
        <circle cx={622} cy={(BLOCK_TOP + BLOCK_BOT) / 2} r={24} fill={C.accent} fillOpacity={0.9 * heat} stroke={C.ink} strokeWidth={4} />
        {/* nozzle: hex + cone */}
        <rect x={X - 62} y={BLOCK_BOT} width={124} height={HEX_BOT - BLOCK_BOT} rx={6} fill={C.bg} stroke={C.ink} strokeWidth={4} />
        <path d={polyD([[X - 48, HEX_BOT], [X - ORIFICE - 6, TIP_Y], [X + ORIFICE + 6, TIP_Y], [X + 48, HEX_BOT]])} fill={C.bg} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
        {/* bore */}
        <path d={polyD(BORE)} fill="none" stroke={C.soft} strokeWidth={3} strokeLinejoin="round" />
      </g>

      {/* molten plastic in the melt zone + nozzle */}
      {slide > 0.98 && (
        <g>
          <path d={polyD(BORE, true)} fill={C.accent} />
          <path d={polyD(BORE, true)} fill="url(#meltgrad)" opacity={melt} />
          <path d={polyD(BORE.slice(1, 5), true)} fill={C.accentHot} opacity={0.55 * melt} filter="url(#glow)" />
        </g>
      )}

      {/* solid filament (feeds down from the spool) */}
      <g clipPath="url(#filclip)">
        <rect x={X - FW} y={F_TOP - 20} width={FW * 2} height={BLOCK_TOP - F_TOP + 20} fill={C.accent} />
        {Array.from({ length: 14 }, (_, i) => {
          const y = F_TOP - 40 + ((i * 34 + disp) % (14 * 34));
          return <line key={i} x1={X - FW + 5} y1={y} x2={X + FW - 5} y2={y} stroke={C.bg} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />;
        })}
      </g>
      <rect x={X - FW - 2} y={F_TOP - 24} width={FW * 2 + 4} height={76} fill="url(#topfade)" />

      {/* drive gears: left turns clockwise, right counter-clockwise -> filament moves down */}
      <g opacity={lerp(0.35, 1, gearsHi) * build}>
        {[-1, 1].map((sgn) => (
          <g key={sgn} transform={`translate(${X + sgn * GEAR_DX} ${GEAR_Y}) rotate(${-sgn * gearAng})`}>
            <path d={GEAR_D} fill={C.bg} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
            <circle r={16} fill="none" stroke={C.ink} strokeWidth={4} />
            <line x1={0} y1={-16} x2={0} y2={-34} stroke={C.soft} strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* extruded bead on the bed (nozzle moves right relative to the bed) */}
      {beadL > 0 && (
        <g>
          <rect x={X - beadL} y={TIP_Y} width={beadL + ORIFICE + 4} height={BED_Y - TIP_Y} rx={(BED_Y - TIP_Y) / 2} fill={C.accent} />
          <rect x={X - beadL} y={TIP_Y} width={beadL + ORIFICE + 4} height={BED_Y - TIP_Y} rx={(BED_Y - TIP_Y) / 2} fill="url(#beadgrad)" opacity={0.9} />
        </g>
      )}

      {/* labels */}
      <Label x={405} y={402} align="end" from={[420, 392]} ax={X - FW - 2} ay={414} title="Filament" value="1.75 mm" p={prog(t, cue("extrusion", "filament") - 0.1, 0.5)} />
      {(() => {
        const p = prog(t, tHot - 0.1, 0.6);
        if (p <= 0) return null;
        const bx = 370;
        return (
          <g opacity={p}>
            <DrawPath d={`M${bx + 16} ${SINK_TOP - 18} L${bx} ${SINK_TOP - 18} L${bx} ${TIP_Y} L${bx + 16} ${TIP_Y}`} p={p} stroke={C.mid} strokeWidth={3} />
            <text x={bx - 22} y={(SINK_TOP + TIP_Y) / 2 + 12} textAnchor="end" fontFamily="Inter" fontWeight={800} fontSize={38} fill={C.ink}>Hot end</text>
          </g>
        );
      })()}
      <Label x={700} y={470} ax={X + GEAR_DX + 30} ay={GEAR_Y - 40} title="Drive gears" p={gearsHi} />
      <Label x={712} y={800} ax={646} ay={(BLOCK_TOP + BLOCK_BOT) / 2} title="Heater" value={prog(t, t200 - 0.1, 0.3) > 0 ? "~200 °C" : undefined} p={prog(t, tHeater - 0.1, 0.5)} />
      <Label x={700} y={958} ax={X + ORIFICE + 10} ay={TIP_Y - 8} title="Nozzle" value={prog(t, t04 - 0.1, 0.3) > 0 ? "0.4 mm" : undefined} p={nozHi} />
      </g>
    </Canvas>
  );
};
