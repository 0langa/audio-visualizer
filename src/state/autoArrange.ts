import type { Scene } from "./timeline";

/**
 * Auto-arrange: turn detected section boundaries into a timeline arrangement.
 *
 * Sections are ranked by their mean energy and mapped onto a calm→energetic
 * ladder of visual modes, so the quiet intro gets an ambient mode and the
 * drop gets a hard-hitting one. Pure — energy arrives as a sampling function
 * so tests can inject a synthetic profile and the store can hand in the
 * waveform overview it already has.
 */

/** Calm → energetic. Deliberately only battle-tested built-ins. */
export const ARRANGE_LADDER: readonly string[] = [
  "aurora",
  "nebula",
  "voice-orb",
  "synthwave",
  "spectrum-bars",
  "tunnel-rings",
  "bass-circle",
  "radial-burst",
];

/** Sections shorter than this merge into their neighbor — a 2-second scene
 * is a flicker, not an arrangement. */
const MIN_SECTION_SEC = 4;
/** Cap: beyond this the timeline stops being editable at a glance. */
const MAX_SCENES = 12;
const FADE_SEC = 0.5;

export function autoArrangeScenes(
  sections: number[],
  duration: number,
  /** Mean energy of [a, b) in track seconds, any consistent scale. */
  energyOf: (a: number, b: number) => number,
  ladder: readonly string[] = ARRANGE_LADDER,
): Scene[] {
  if (duration <= 0 || ladder.length === 0) return [];
  // Segment starts: 0 plus every in-range boundary, deduped and sorted.
  const starts = [0, ...sections.filter((s) => s > 0 && s < duration)]
    .sort((a, b) => a - b)
    .filter((s, i, arr) => i === 0 || s - arr[i - 1] > 0.001);
  // Merge short segments into their predecessor: a boundary too close to the
  // previous kept start is dropped (and a too-short final segment folds back).
  const merged: number[] = [starts[0]];
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] - merged[merged.length - 1] < MIN_SECTION_SEC) continue;
    merged.push(starts[i]);
  }
  while (merged.length > 1 && duration - merged[merged.length - 1] < MIN_SECTION_SEC) {
    merged.pop();
  }
  // Down-sample evenly when there are too many sections to be useful.
  const kept =
    merged.length <= MAX_SCENES
      ? merged
      : merged.filter((_, i) => i % Math.ceil(merged.length / MAX_SCENES) === 0);

  const energies = kept.map((s, i) => energyOf(s, i + 1 < kept.length ? kept[i + 1] : duration));
  // Rank → ladder position. Ties keep first-come order (stable sort).
  const order = energies
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e - b.e)
    .map(({ i }) => i);
  const rankOf = new Array<number>(order.length);
  order.forEach((sceneIdx, rank) => {
    rankOf[sceneIdx] = rank;
  });

  return kept.map((start, i) => {
    const ladderIdx =
      kept.length === 1
        ? ladder.length - 1
        : Math.round((rankOf[i] / (kept.length - 1)) * (ladder.length - 1));
    return {
      id: `auto-${i}-${Math.round(start * 1000)}`,
      name: i === 0 ? "Intro" : `Section ${i + 1}`,
      presetId: ladder[ladderIdx],
      start,
      fadeSec: i === 0 ? 0 : FADE_SEC,
      params: {},
    };
  });
}

/** Mean of a peak-envelope overview across a time span — the store's
 * 4096-bucket waveform overview plugs straight in. */
export function overviewEnergy(
  overview: Float32Array,
  duration: number,
): (a: number, b: number) => number {
  return (a, b) => {
    if (duration <= 0 || overview.length === 0 || b <= a) return 0;
    const i0 = Math.max(0, Math.floor((a / duration) * overview.length));
    const i1 = Math.min(overview.length, Math.ceil((b / duration) * overview.length));
    let sum = 0;
    for (let i = i0; i < i1; i++) sum += overview[i];
    return i1 > i0 ? sum / (i1 - i0) : 0;
  };
}
