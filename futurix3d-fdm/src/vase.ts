// Shared vase geometry (side view), used by slicing, outro and cover.
// u = 0 at the foot, 1 at the lip. Radius is a cosine-interpolated profile
// through its extrema, so the silhouette has no kinks.
const CP: [number, number][] = [
  [0.0, 0.55],
  [0.3, 1.0], // belly
  [0.8, 0.4], // neck
  [1.0, 0.58], // lip
];

export const vaseR = (u: number) => {
  for (let i = 0; i < CP.length - 1; i++) {
    const [u0, r0] = CP[i];
    const [u1, r1] = CP[i + 1];
    if (u <= u1 || i === CP.length - 2) {
      const f = Math.min(1, Math.max(0, (u - u0) / (u1 - u0)));
      return r0 + (r1 - r0) * (1 - Math.cos(Math.PI * f)) / 2;
    }
  }
  return CP[CP.length - 1][1];
};

export type VaseBox = { cx: number; top: number; bottom: number; rmax: number; tilt: number };
export const VASE: VaseBox = { cx: 540, top: 470, bottom: 1130, rmax: 220, tilt: 0.22 };

export const vaseY = (b: VaseBox, u: number) => b.bottom - (b.bottom - b.top) * u;

/** Silhouette outline: left profile up, right profile down (open path). */
export const vaseSides = (b: VaseBox, n = 80) => {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const r = vaseR(u) * b.rmax;
    left.push(`${i ? "L" : "M"}${(b.cx - r).toFixed(1)} ${vaseY(b, u).toFixed(1)}`);
    right.push(`${i ? "L" : "M"}${(b.cx + r).toFixed(1)} ${vaseY(b, u).toFixed(1)}`);
  }
  return { left: left.join(" "), right: right.join(" ") };
};

/** Closed filled silhouette (front half-ellipses at the lip and foot). */
export const vaseFill = (b: VaseBox, n = 80) => {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(`${i ? "L" : "M"}${(b.cx - vaseR(u) * b.rmax).toFixed(1)} ${vaseY(b, u).toFixed(1)}`);
  }
  const rt = vaseR(1) * b.rmax;
  pts.push(`A${rt} ${rt * b.tilt} 0 0 1 ${b.cx + rt} ${vaseY(b, 1)}`);
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    pts.push(`L${(b.cx + vaseR(u) * b.rmax).toFixed(1)} ${vaseY(b, u).toFixed(1)}`);
  }
  const rb = vaseR(0) * b.rmax;
  pts.push(`A${rb} ${rb * b.tilt} 0 0 1 ${b.cx - rb} ${vaseY(b, 0)} Z`);
  return pts.join(" ");
};

/** Silhouette with flat top/bottom (side elevation, used as a clip). */
export const vaseFlat = (b: VaseBox, n = 80) => {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${i ? "L" : "M"}${(b.cx - vaseR(i / n) * b.rmax).toFixed(1)} ${vaseY(b, i / n).toFixed(1)}`);
  for (let i = n; i >= 0; i--) pts.push(`L${(b.cx + vaseR(i / n) * b.rmax).toFixed(1)} ${vaseY(b, i / n).toFixed(1)}`);
  return pts.join(" ") + " Z";
};

/** Front (lower) and back (upper) half of a horizontal ellipse slice. */
export const sliceArcs = (cx: number, y: number, r: number, tilt: number) => ({
  front: `M${cx - r} ${y} A${r} ${r * tilt} 0 0 0 ${cx + r} ${y}`,
  back: `M${cx - r} ${y} A${r} ${r * tilt} 0 0 1 ${cx + r} ${y}`,
});
