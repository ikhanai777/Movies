// All animation cues are derived from the real voiceover word timestamps
// (src/timing.json, written by scripts/gen_vo.py). Nothing is hand-timed.
import data from "./timing.json";

export type Word = { w: string; s: number; e: number };
export type SceneId =
  | "hook"
  | "slicing"
  | "extrusion"
  | "motion"
  | "layers"
  | "cooling"
  | "outro";

export const scenes = data.scenes as {
  id: SceneId;
  start: number;
  end: number;
  words: Word[];
}[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const scene = (id: SceneId) => {
  const s = scenes.find((x) => x.id === id);
  if (!s) throw new Error(`no scene ${id}`);
  return s;
};

/** Start time (s) of the nth occurrence of `word` in scene `id`. */
export const cue = (id: SceneId, word: string, nth = 1): number => {
  const hits = scene(id).words.filter((w) => norm(w.w) === norm(word));
  if (hits.length < nth) throw new Error(`cue "${word}"#${nth} not in ${id}`);
  return hits[nth - 1].s;
};

/** End time (s) of the nth occurrence of `word` in scene `id`. */
export const cueEnd = (id: SceneId, word: string, nth = 1): number => {
  const hits = scene(id).words.filter((w) => norm(w.w) === norm(word));
  if (hits.length < nth) throw new Error(`cue "${word}"#${nth} not in ${id}`);
  return hits[nth - 1].e;
};

/**
 * Visual scene windows. Scene N+1 begins at the midpoint of the silence
 * between VO lines; transitions are centred on that boundary.
 */
export const TRANSITION = 0.6; // seconds
const order: SceneId[] = scenes.map((s) => s.id);
export const sceneWindow = (id: SceneId) => {
  const i = order.indexOf(id);
  const prev = scenes[i - 1];
  const cur = scenes[i];
  const next = scenes[i + 1];
  const from = prev ? (prev.end + cur.start) / 2 : 0;
  const to = next ? (cur.end + next.start) / 2 : 60;
  return { from, to };
};
