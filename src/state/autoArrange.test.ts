import { describe, expect, it } from "vitest";
import { ARRANGE_LADDER, autoArrangeScenes, overviewEnergy } from "./autoArrange";
import { presets } from "../render/presets";

describe("autoArrangeScenes", () => {
  // Energy profile: quiet, loud, medium
  const energy = (a: number) => (a < 30 ? 0.1 : a < 60 ? 0.9 : 0.5);

  it("maps quiet sections to calm modes and loud ones to energetic modes", () => {
    const scenes = autoArrangeScenes([30, 60], 90, energy);
    expect(scenes).toHaveLength(3);
    expect(scenes.map((s) => s.start)).toEqual([0, 30, 60]);
    // ranks: 0 (quiet) < 2 (medium) < 1 (loud)
    expect(scenes[0].presetId).toBe(ARRANGE_LADDER[0]); // calmest
    expect(scenes[1].presetId).toBe(ARRANGE_LADDER[ARRANGE_LADDER.length - 1]); // hardest
    expect(scenes[0].fadeSec).toBe(0); // the intro cuts in, later scenes fade
    expect(scenes[1].fadeSec).toBeGreaterThan(0);
  });

  it("every ladder id is a real registered preset", () => {
    for (const id of ARRANGE_LADDER) {
      expect(presets.some((p) => p.id === id)).toBe(true);
    }
  });

  it("merges too-short sections and caps the scene count", () => {
    const scenes = autoArrangeScenes([2, 30], 90, energy); // 0..2 is a flicker
    expect(scenes.map((s) => s.start)).toEqual([0, 30]);
    const many = autoArrangeScenes(
      Array.from({ length: 40 }, (_, i) => (i + 1) * 5),
      210,
      () => 0.5,
    );
    expect(many.length).toBeLessThanOrEqual(12);
  });

  it("ignores out-of-range boundaries and handles the single-section case", () => {
    const scenes = autoArrangeScenes([-5, 120], 90, energy);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].start).toBe(0);
  });
});

describe("overviewEnergy", () => {
  it("means the right bucket span", () => {
    const overview = Float32Array.from({ length: 100 }, (_, i) => (i < 50 ? 0 : 1));
    const e = overviewEnergy(overview, 100);
    expect(e(0, 50)).toBe(0);
    expect(e(50, 100)).toBe(1);
    expect(e(25, 75)).toBeCloseTo(0.5, 5);
  });
});
