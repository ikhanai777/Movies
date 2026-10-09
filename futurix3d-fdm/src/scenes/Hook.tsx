import React from "react";
import { Canvas, DrawPath, Pt, circleD, polyD } from "../components";
import { cue, cueEnd } from "../timing";
import { C, prog } from "../theme";

// One orange line draws across the blank screen, then coils into a spool.
const CX = 540, CY = 800, R_OUT = 232, R_IN = 96, PITCH = 13;

const linePts: Pt[] = (() => {
  const pts: Pt[] = [];
  // straight run in from off-screen left, tangent to the top of the coil
  for (let x = -60; x <= CX; x += 20) pts.push([x, CY - R_OUT]);
  // clockwise Archimedean spiral inward (screen coords: +angle = clockwise)
  const turns = (R_OUT - R_IN) / PITCH;
  const steps = Math.round(turns * 120);
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const a = -Math.PI / 2 + f * turns * 2 * Math.PI;
    const r = R_OUT - f * (R_OUT - R_IN);
    pts.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]);
  }
  return pts;
})();
const LINE_D = polyD(linePts);

export const Hook: React.FC<{ t: number }> = ({ t }) => {
  const t0 = cue("hook", "every") - 0.15;
  const tEnd = cueEnd("hook", "plastic");
  // line + coil draw across the whole hook sentence
  const draw = prog(t, t0, tEnd - t0 - 0.35);
  const flange = prog(t, cue("hook", "single"), 0.9);
  const hub = prog(t, cue("hook", "thread"), 0.7);
  // gentle settle-in rotation once wound
  const spin = prog(t, cue("hook", "thread"), 2.0) * 25;
  return (
    <Canvas>
      <g transform={`rotate(${spin} ${CX} ${CY})`}>
        <DrawPath d={circleD(CX, CY, R_OUT + 26)} p={flange} />
        <DrawPath d={circleD(CX, CY, R_OUT + 12)} p={flange} stroke={C.faint} strokeWidth={3} />
        <DrawPath d={circleD(CX, CY, R_IN - 14)} p={hub} />
        <DrawPath d={circleD(CX, CY, 34)} p={hub} />
        {[0, 120, 240].map((a) => {
          const r = (a * Math.PI) / 180;
          return (
            <DrawPath key={a} d={`M${CX + 34 * Math.cos(r)} ${CY + 34 * Math.sin(r)} L${CX + (R_IN - 14) * Math.cos(r)} ${CY + (R_IN - 14) * Math.sin(r)}`} p={hub} stroke={C.soft} strokeWidth={3} />
          );
        })}
      </g>
      <DrawPath d={LINE_D} p={draw} stroke={C.accent} strokeWidth={7} />
    </Canvas>
  );
};
