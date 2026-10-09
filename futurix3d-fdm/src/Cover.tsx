import React from "react";
import { AbsoluteFill } from "remotion";
import { Canvas } from "./components";
import { WordmarkText } from "./Overlays";
import { C, FONT } from "./theme";
import { VaseBox, vaseR } from "./vase";

// Cover frame. Everything sits inside the centre 1080x1440 (3:4 grid crop,
// y 240–1680) and is big enough to read as a small grid thumbnail.
const V: VaseBox = { cx: 540, top: 760, bottom: 1340, rmax: 236, tilt: 0.22 };
const N = 30;

export const Cover: React.FC = () => {
  const strip = (V.bottom - V.top) / N;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 112, lineHeight: 1.04, letterSpacing: -3, color: C.ink }}>
        How <span style={{ color: C.accent }}>3D</span> Printing
        <br />
        Works
      </div>
      <Canvas>
        {/* sliced vase: orange layers, the top few lifted apart */}
        {Array.from({ length: N }, (_, i) => {
          const u = (i + 0.5) / N;
          const r = vaseR(u) * V.rmax;
          // top layers drift apart: the model being sliced
          const k = Math.max(0, i - (N - 7));
          const lift = (k * (k + 1)) / 2 * 6;
          const y = V.bottom - (i + 1) * strip - lift;
          const h = strip - 4;
          return <rect key={i} x={V.cx - r} y={y} width={r * 2} height={h} rx={h / 2} fill={C.accent} />;
        })}
      </Canvas>
      <div style={{ position: "absolute", top: 1440, left: 0, right: 0, textAlign: "center", lineHeight: 1 }}>
        <WordmarkText size={78} />
      </div>
    </AbsoluteFill>
  );
};
