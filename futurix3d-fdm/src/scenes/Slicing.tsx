import React from "react";
import { Canvas, DrawPath, Pt, polyD } from "../components";
import { cue, sceneWindow } from "../timing";
import { C, MONO, clamp01, lerp, prog } from "../theme";
import { VASE, sliceArcs, vaseFill, vaseR, vaseSides, vaseY } from "../vase";

const N = 24; // slices drawn (stands in for "hundreds")
const SEL = 9; // the layer that becomes a toolpath
const uOf = (i: number) => (i + 0.5) / N;

// Toolpath target (top-down) and group move
const TP = { x: 790, y: 640, r: 170 };
const G = { cx: 540, cy: 800, dx: -250, s: 0.72 };
const gx = (x: number, p: number) => G.cx + (x - G.cx) * lerp(1, G.s, p) + G.dx * p;
const gy = (y: number, p: number) => G.cy + (y - G.cy) * lerp(1, G.s, p);

// Inner perimeter, then (after a travel move, not drawn) 45° rectilinear infill
const innerWall: Pt[] = Array.from({ length: 91 }, (_, i) => {
  const a = (i / 90) * 2 * Math.PI;
  return [TP.x + (TP.r - 13) * Math.cos(a), TP.y + (TP.r - 13) * Math.sin(a)] as Pt;
});
const infill: Pt[] = (() => {
  const pts: Pt[] = [];
  const rf = TP.r - 24, sp = 25, c = Math.SQRT1_2;
  let dir = 1;
  for (let d = -rf + sp / 2; d < rf; d += sp) {
    const h = Math.sqrt(rf * rf - d * d);
    const ends: [number, number][] = dir > 0 ? [[d, -h], [d, h]] : [[d, h], [d, -h]];
    for (const [u, v] of ends) pts.push([TP.x + (u - v) * c, TP.y + (u + v) * c]);
    dir = -dir;
  }
  return pts;
})();
const INNER_D = polyD(innerWall);
const INFILL_D = polyD(infill);

// Real-looking G-code for that layer: 0.2 mm layers, 0.45 mm line width,
// 1.75 mm filament -> E per mm = 0.2*0.45 / (pi*0.875^2) ≈ 0.0374.
const LAYERS_TOTAL = 412;
const layerNo = Math.round(uOf(SEL) * LAYERS_TOTAL);
const zmm = (layerNo * 0.2).toFixed(1);
const rmm = (vaseR(uOf(SEL)) * VASE.rmax) / 8; // 8 px per mm
const gcode: string[] = (() => {
  const L = [`;LAYER:${layerNo} of ${LAYERS_TOTAL}`, `G1 Z${zmm} F600`];
  const steps = 30;
  const seg = (2 * Math.PI * rmm) / steps;
  for (let i = 0; i <= steps * 2; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const x = (110 + rmm * Math.cos(a)).toFixed(2);
    const y = (110 + rmm * Math.sin(a)).toFixed(2);
    L.push(i === 0 ? `G1 X${x} Y${y} F1800` : `G1 X${x} Y${y} E${(seg * 0.0374).toFixed(4)}`);
  }
  return L;
})();

export const Slicing: React.FC<{ t: number }> = ({ t }) => {
  const w = sceneWindow("slicing");
  const outline = prog(t, w.from + 0.05, 1.3);
  const tSl = cue("slicing", "slicer");
  const sweepP = prog(t, tSl - 0.05, 1.5, (x) => x);
  const planeY = lerp(VASE.top - 40, VASE.bottom + 40, sweepP);
  const planeVis = Math.min(prog(t, tSl - 0.2, 0.25), 1 - prog(t, tSl + 1.4, 0.3));
  const explode = prog(t, cue("slicing", "hundreds"), 0.8);
  const solidFade = 1 - explode;
  const tTurn = cue("slicing", "turns");
  const move = prog(t, tTurn - 0.15, 0.9);
  const lift = prog(t, tTurn + 0.1, 1.0);
  const tp = prog(t, cue("slicing", "path") - 0.4, 1.4);
  const tCode = cue("slicing", "coordinates");
  const codeIn = prog(t, tCode - 0.35, 0.4);

  const { left, right } = vaseSides(VASE);
  const gt = `translate(${G.dx * move} 0) translate(${G.cx} ${G.cy}) scale(${lerp(1, G.s, move)}) translate(${-G.cx} ${-G.cy})`;

  // selected ring: in-group position -> toolpath target, tilt 0.22 -> 1 (top-down)
  const yi = vaseY(VASE, uOf(SEL)) + (SEL - (N - 1) / 2) * 10 * explode;
  const ri = vaseR(uOf(SEL)) * VASE.rmax;
  const sx = lerp(gx(VASE.cx, move), TP.x, lift);
  const sy = lerp(gy(yi, move), TP.y, lift);
  const sr = lerp(ri * lerp(1, G.s, move), TP.r, lift);
  const tilt = lerp(VASE.tilt, 1, lift);
  const selOn = prog(t, tTurn - 0.3, 0.3);

  // G-code scroll: one new line every 0.1 s
  const visible = 7;
  const lines = Math.floor(clamp01(codeIn) * 2 + Math.max(0, (t - tCode + 0.2) / 0.1));
  const first = Math.max(0, Math.min(lines, gcode.length) - visible);

  return (
    <Canvas>
      <g transform={gt}>
        <path d={vaseFill(VASE)} fill={C.faint} opacity={0.55 * outline * solidFade} />
        <g opacity={solidFade}>
          <DrawPath d={left} p={outline} />
          <DrawPath d={right} p={outline} />
          {(() => {
            const rt = vaseR(1) * VASE.rmax;
            const a = sliceArcs(VASE.cx, VASE.top, rt, VASE.tilt);
            const rb = vaseR(0) * VASE.rmax;
            const b = sliceArcs(VASE.cx, VASE.bottom, rb, VASE.tilt);
            return (
              <>
                <DrawPath d={a.front} p={outline} />
                <DrawPath d={a.back} p={outline} />
                <DrawPath d={b.front} p={outline} />
              </>
            );
          })()}
        </g>
        {Array.from({ length: N }, (_, i) => {
          const u = uOf(i);
          const y0 = vaseY(VASE, u);
          const appear = clamp01((planeY - y0) / 30);
          if (appear <= 0) return null;
          const y = y0 + (i - (N - 1) / 2) * 10 * explode;
          const r = vaseR(u) * VASE.rmax;
          const arcs = sliceArcs(VASE.cx, y, r, VASE.tilt);
          const hide = i === SEL ? 1 - selOn : 1;
          return (
            <g key={i} opacity={appear * hide}>
              <path d={arcs.back} fill="none" stroke={C.soft} strokeWidth={3} opacity={explode} strokeLinecap="round" />
              <path d={arcs.front} fill="none" stroke={explode > 0.5 ? C.ink : C.mid} strokeWidth={3} strokeLinecap="round" />
            </g>
          );
        })}
      </g>

      {/* slicing plane */}
      {planeVis > 0 && (
        <g opacity={planeVis}>
          <ellipse cx={VASE.cx} cy={planeY} rx={300} ry={300 * VASE.tilt} fill={C.ink} opacity={0.05} />
          <ellipse cx={VASE.cx} cy={planeY} rx={300} ry={300 * VASE.tilt} fill="none" stroke={C.ink} strokeWidth={3} />
        </g>
      )}

      {/* the selected layer lifts out and flattens into a top-down toolpath */}
      {selOn > 0 && (
        <g opacity={selOn}>
          <ellipse cx={sx} cy={sy} rx={sr} ry={sr * tilt} fill={lift > 0.5 ? C.bg : "none"} stroke={C.accent} strokeWidth={lerp(4, 7, lift)} />
          <DrawPath d={INNER_D} p={tp * 3} stroke={C.accent} strokeWidth={6} />
          <DrawPath d={INFILL_D} p={(tp - 0.36) / 0.64} stroke={C.accent} strokeWidth={6} />
        </g>
      )}

      {/* G-code */}
      {codeIn > 0 && (
        <g opacity={codeIn} transform={`translate(0 ${(1 - codeIn) * 20})`}>
          <rect x={598} y={862} width={432} height={300} rx={18} fill="#FBFAF7" stroke={C.faint} strokeWidth={3} />
          <clipPath id="codeclip"><rect x={598} y={878} width={432} height={270} /></clipPath>
          <g clipPath="url(#codeclip)">
            {gcode.slice(first, Math.min(lines, gcode.length)).map((ln, i) => {
              const isNew = first + i === Math.min(lines, gcode.length) - 1;
              const [cmd, ...rest] = ln.split(" ");
              return (
                <text key={first + i} x={622} y={914 + i * 36} fontFamily={MONO} fontSize={23} fill={ln.startsWith(";") ? C.soft : C.mid} opacity={isNew ? 0.7 : 1}>
                  {ln.startsWith(";") ? ln : (<><tspan fill={C.ink} fontWeight={700}>{cmd}</tspan>{" " + rest.join(" ")}</>)}
                </text>
              );
            })}
          </g>
        </g>
      )}
    </Canvas>
  );
};
