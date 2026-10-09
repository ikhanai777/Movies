import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const weights = [400, 500, 600, 700, 800] as const;

export const fontsReady = Promise.all([
  ...weights.map((w) =>
    loadFont({
      family: "Inter",
      url: staticFile(`fonts/inter-latin-${w}-normal.woff2`),
      weight: String(w),
    }),
  ),
  loadFont({
    family: "JetBrains Mono",
    url: staticFile("fonts/jetbrains-mono-latin-500-normal.woff2"),
    weight: "500",
  }),
]);
