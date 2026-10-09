import React from "react";
import { Arrow, Canvas, Label, Pt, polyD, polyLengths, polyUpTo } from "../components";
import { cue, sceneWindow } from "../timing";
import { C, FONT, clamp01, ease, lerp, prog } from "../theme";

// Top-down view of the build plate. Nozzle moves in X/Y, traces the outer
// wall, then the inner wall, then fills the inside with 45° infill.
const CX = 540, CY = 800;
const PLATE = { x: 200, y: 460, s: 680 };
const R_OUT = 200, R_IN = 186, R_FILL = 174, BEAD = 11;

type Seg = { t0: number; t1: number; pts: Pt[]; extrude: boolean; lin?: boolean };

const circlePts = (r: number, n = 160): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [CX + r * Math.cos((i / n) * 2 * Math.PI), CY + r * Math.sin((i / n) * 2 * Math.PI)]);

const infillPts: Pt[] = (() => {
  const pts: Pt[] = [];
  const sp = 30, c = Math.SQRT1_2;
  let dir = 1;
  for (let d = -R_FILL + sp / 2; d < R_FILL; d += sp) {
    const h = Math.sqrt(R_FILL * R_FILL - d * d);
    const ends: [number, number][] = dir > 0 ? [[d, -h], [d, h]] : [[d, h], [d, -h]];
    for (const [u, v] of ends) pts.push([CX + (u - v) * c, CY + (u + v) * c]);
    dir = -dir;
  }
  return pts;
})();

const buildSegs = (): Seg[] => {
  const tX = cue("motion", "x"), tY = cue("motion", "y");
  const tTrace = cue("motion", "tracing"), tFirst = cue("motion", "first");
  const tFill = cue("motion", "filling"), tEnd = sceneWindow("motion").to;
  const p0: Pt = [380, 640], p1: Pt = [700, 640], p2: Pt = [700, 800];
  return [
    { t0: tX - 0.05, t1: tX + 0.4, pts: [p0, p1], extrude: false },
    { t0: tY - 0.05, t1: tY + 0.4, pts: [p1, p2], extrude: false },
    { t0: tTrace - 0.35, t1: tTrace - 0.05, pts: [p2, [CX + R_OUT, CY]], extrude: false },
    { t0: tTrace, t1: tFirst + 0.25, pts: circlePts(R_OUT), extrude: true, lin: true },
    { t0: tFirst + 0.25, t1: tFirst + 0.4, pts: [[CX + R_OUT, CY], [CX + R_IN, CY]], extrude: false },
    { t0: tFirst + 0.4, t1: tFill - 0.05, pts: circlePts(R_IN), extrude: true, lin: true },
    { t0: tFill - 0.05, t1: tFill + 0.1, pts: [[CX + R_IN, CY], infillPts[0]], extrude: false },
    { t0: tFill + 0.1, t1: tEnd - 0.35, pts: infillPts, extrude: true, lin: true },
  ];
};

export const Motion: React.FC<{ t: number }> = ({ t }) => {
  const w = sceneWindow("motion");
  const segs = buildSegs();
  const build = prog(t, w.from - 0.3, 0.6);
  const tMotors = cue("motion", "motors");
  const nozIn = prog(t, cue("motion", "nozzle") - 0.2, 0.4);
  const xHi = prog(t, cue("motion", "x") - 0.1, 0.3) * (1 - prog(t, cue("motion", "x") + 0.6, 0.4));
  const yHi = prog(t, cue("motion", "y") - 0.1, 0.3) * (1 - prog(t, cue("motion", "y") + 0.6, 0.4));

  // nozzle position + extruded geometry
  let pos: Pt = segs[0].pts[0];
  const drawn: { pts: Pt[] }[] = [];
  let extruding = false;
  for (const s of segs) {
    const acc = polyLengths(s.pts);
    const total = acc[acc.length - 1];
    if (t < s.t0) break;
    const f = clamp01((t - s.t0) / (s.t1 - s.t0));
    const pf = s.lin ? f : ease(f);
    const sub = polyUpTo(s.pts, acc, pf * total);
    pos = sub[sub.length - 1];
    if (s.extrude) drawn.push({ pts: sub });
    extruding = s.extrude && f < 1;
  }

  return (
    <Canvas>
      {/* build plate */}
      <g opacity={build}>
        <rect x={PLATE.x} y={PLATE.y} width={PLATE.s} height={PLATE.s} rx={28} fill="#EFECE5" stroke={C.soft} strokeWidth={4} />
        {Array.from({ length: 9 }, (_, i) =>
          Array.from({ length: 9 }, (_, j) => (
            <circle key={`${i}-${j}`} cx={PLATE.x + 68 * (i + 1)} cy={PLATE.y + 68 * (j + 1)} r={3} fill={C.faint} />
          )),
        )}
      </g>

      {/* axes */}
      <g opacity={prog(t, tMotors - 0.15, 0.5)}>
        <Arrow x1={PLATE.x} y1={PLATE.y + PLATE.s + 48} x2={PLATE.x + 250} y2={PLATE.y + PLATE.s + 48} width={4 + 3 * xHi} />
        <text x={PLATE.x + 272} y={PLATE.y + PLATE.s + 62} fontFamily={FONT} fontWeight={800} fontSize={40 + 8 * xHi} fill={C.ink}>X</text>
        <Arrow x1={PLATE.x - 42} y1={PLATE.y + PLATE.s} x2={PLATE.x - 42} y2={PLATE.y + PLATE.s - 250} width={4 + 3 * yHi} />
        <text x={PLATE.x - 42} y={PLATE.y + PLATE.s - 272} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={40 + 8 * yHi} fill={C.ink}>Y</text>
      </g>

      {/* extruded lines */}
      {drawn.map((d, i) => (
        <path key={i} d={polyD(d.pts)} fill="none" stroke={C.accent} strokeWidth={i === 2 ? BEAD - 2 : BEAD} strokeLinecap="round" strokeLinejoin="round" opacity={i === 2 ? 0.9 : 1} />
      ))}

      {/* gantry guides through the nozzle */}
      <g opacity={0.9 * nozIn}>
        <line x1={PLATE.x} y1={pos[1]} x2={PLATE.x + PLATE.s} y2={pos[1]} stroke={C.ink} strokeWidth={3} opacity={0.18 + 0.4 * xHi} strokeDasharray="2 12" strokeLinecap="round" />
        <line x1={pos[0]} y1={PLATE.y} x2={pos[0]} y2={PLATE.y + PLATE.s} stroke={C.ink} strokeWidth={3} opacity={0.18 + 0.4 * yHi} strokeDasharray="2 12" strokeLinecap="round" />
      </g>

      {/* nozzle (top-down) */}
      <g opacity={nozIn} transform={`translate(${pos[0]} ${pos[1]}) scale(${lerp(0.6, 1, nozIn)})`}>
        <circle r={30} fill={C.bg} fillOpacity={0.85} stroke={C.ink} strokeWidth={4} />
        <circle r={9} fill={extruding ? C.accent : C.ink} />
      </g>

      <Label x={700} y={430} ax={CX + R_OUT * Math.cos(-0.9)} ay={CY + R_OUT * Math.sin(-0.9)} title="Outer wall" p={prog(t, cue("motion", "outer") - 0.1, 0.5)} />
      <Label x={720} y={1110} ax={CX + 60} ay={CY + 70} title="Infill" p={prog(t, cue("motion", "pattern") - 0.1, 0.5)} />
    </Canvas>
  );
};
