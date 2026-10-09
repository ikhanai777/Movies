import React from "react";
import { C, FONT, STROKE, clamp01 } from "./theme";

export type Pt = [number, number];

export const polyD = (pts: Pt[], closed = false) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + (closed ? " Z" : "");

/** Path drawn on progressively (0..1) via normalised dash offset. */
export const DrawPath: React.FC<
  { d: string; p: number } & React.SVGProps<SVGPathElement>
> = ({ d, p, ...rest }) => {
  if (p <= 0.0005) return null;
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - clamp01(p)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={STROKE}
      stroke={C.ink}
      {...rest}
    />
  );
};

/** Cumulative-length helper for polylines: returns the sub-polyline up to length L. */
export const polyLengths = (pts: Pt[]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++)
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return acc;
};
export const polyUpTo = (pts: Pt[], acc: number[], L: number): Pt[] => {
  if (L <= 0) return [pts[0]];
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (acc[i] <= L) out.push(pts[i]);
    else {
      const f = (L - acc[i - 1]) / (acc[i] - acc[i - 1]);
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
      break;
    }
  }
  return out;
};

export const circleD = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Arrow with rounded head. p = draw progress. */
export const Arrow: React.FC<{
  x1: number; y1: number; x2: number; y2: number; p?: number; color?: string; width?: number; head?: number;
}> = ({ x1, y1, x2, y2, p = 1, color = C.ink, width = STROKE, head = 18 }) => {
  if (p <= 0) return null;
  const x = x1 + (x2 - x1) * p;
  const y = y1 + (y2 - y1) * p;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h1: Pt = [x - head * Math.cos(a - 0.5), y - head * Math.sin(a - 0.5)];
  const h2: Pt = [x - head * Math.cos(a + 0.5), y - head * Math.sin(a + 0.5)];
  return (
    <g stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={`M${x1} ${y1} L${x} ${y}`} />
      <path d={polyD([h1, [x, y], h2])} />
    </g>
  );
};

/**
 * Diagram label: regular-weight name + optional bold value, with a leader
 * line from the text to an anchor point. `p` fades/slides it in.
 */
export const Label: React.FC<{
  x: number; y: number; // text position
  ax?: number; ay?: number; // leader anchor (optional)
  title: string;
  value?: string;
  align?: "start" | "end" | "middle";
  p: number;
  size?: number;
  from?: [number, number]; // leader start (defaults to beside the text)
}> = ({ x, y, ax, ay, title, value, align = "start", p, size = 34, from }) => {
  if (p <= 0) return null;
  const dx = align === "start" ? -14 : align === "end" ? 14 : 0;
  const lx = align === "start" ? x - 16 : align === "end" ? x + 16 : x;
  return (
    <g opacity={clamp01(p)}>
      {ax !== undefined && ay !== undefined && (
        <DrawPath d={`M${from ? from[0] : lx} ${from ? from[1] : y - size * 0.32} L${ax} ${ay}`} p={p} stroke={C.mid} strokeWidth={3} />
      )}
      {ax !== undefined && ay !== undefined && p > 0.6 && (
        <circle cx={ax} cy={ay} r={5} fill={C.ink} opacity={clamp01((p - 0.6) / 0.4)} />
      )}
      <g transform={`translate(${dx * (1 - p)} 0)`}>
        <text x={x} y={y} fontFamily={FONT} fontWeight={500} fontSize={size} fill={C.mid} textAnchor={align}>
          {title}
        </text>
        {value && (
          <text x={x} y={y + size * 1.25} fontFamily={FONT} fontWeight={800} fontSize={size * 1.12} fill={C.ink} textAnchor={align}>
            {value}
          </text>
        )}
      </g>
    </g>
  );
};

/** Full-frame SVG canvas used by every scene. */
export const Canvas: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
    </defs>
    {children}
  </svg>
);
