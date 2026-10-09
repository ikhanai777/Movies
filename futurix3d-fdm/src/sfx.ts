// Sound-design cue list, derived from the same VO timestamps as the visuals.
import { cue, scenes, sceneWindow } from "./timing";
import { FINAL_START } from "./scenes/Outro";

export type Sfx = { t: number; kind: "whoosh" | "click" | "chime" };

export const sfxCues = (): Sfx[] => {
  const out: Sfx[] = [];
  // whoosh centred on every scene transition
  for (const s of scenes.slice(1)) out.push({ t: sceneWindow(s.id).from - 0.3, kind: "whoosh" });
  const clicks: [Parameters<typeof cue>[0], string][] = [
    ["slicing", "slicer"], ["slicing", "path"], ["slicing", "coordinates"],
    ["extrusion", "filament"], ["extrusion", "hot"], ["extrusion", "drive"], ["extrusion", "heater"], ["extrusion", "nozzle"],
    ["motion", "x"], ["motion", "y"], ["motion", "outer"], ["motion", "pattern"],
    ["layers", "bed"], ["layers", "rises"], ["layers", "fraction"], ["layers", "fuses"],
    ["cooling", "fan"], ["cooling", "supports"],
    ["outro", "that's"],
  ];
  for (const [id, w] of clicks) out.push({ t: cue(id, w) - 0.1, kind: "click" });
  out.push({ t: FINAL_START + 0.9, kind: "chime" });
  return out.sort((a, b) => a.t - b.t);
};
