import { describe, expect, it } from "vitest";
import { applyMods, validModRoutes } from "./modMatrix";
import { presets } from "../render/presets";
import { defaultParams } from "../render/types";
import type { AudioFeatures } from "../audio/types";

const preset = presets[0];
const spec = preset.params[0]; // first numeric param of the first preset

function features(partial: Partial<AudioFeatures>): AudioFeatures {
  return {
    bins: new Float32Array(96),
    peaks: new Float32Array(96),
    waveform: new Float32Array(512),
    rms: 0,
    energy: 0,
    voice: 0,
    drive: 0,
    driveBeat: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    width: 0,
    lufs: -70,
    kick: 0,
    snare: 0,
    hat: 0,
    bpm: 0,
    beatPhase: 0,
    barPhase: 0,
    beat: false,
    beatIntensity: 0,
    time: 0,
    duration: 0,
    ...partial,
  };
}

describe("modulation matrix", () => {
  it("returns base unchanged (same object) with no routes", () => {
    const base = defaultParams(preset);
    expect(applyMods(preset, base, [], features({ kick: 1 }))).toBe(base);
  });

  it("adds amount × range at feature = 1 and clamps to spec max", () => {
    const base = defaultParams(preset);
    const routes = [{ id: "r", source: "kick" as const, param: spec.key, amount: 1 }];
    const out = applyMods(preset, base, routes, features({ kick: 1 }));
    expect(out[spec.key]).toBe(spec.max); // default + full range clamps at max
    // Feature at 0 leaves the param alone
    const idle = applyMods(preset, base, routes, features({ kick: 0 }));
    expect(idle[spec.key]).toBe(base[spec.key]);
  });

  it("negative amounts subtract and clamp at min", () => {
    const base = defaultParams(preset);
    const routes = [{ id: "r", source: "rms" as const, param: spec.key, amount: -1 }];
    const out = applyMods(preset, base, routes, features({ rms: 1 }));
    expect(out[spec.key]).toBe(spec.min);
  });

  it("skips routes to params the preset doesn't have", () => {
    const base = defaultParams(preset);
    const routes = [{ id: "r", source: "kick" as const, param: "noSuchParam", amount: 1 }];
    const out = applyMods(preset, base, routes, features({ kick: 1 }));
    expect(out).toEqual(base);
  });

  it("stacks multiple routes onto one param", () => {
    const base = { ...defaultParams(preset), [spec.key]: spec.min };
    const quarter = 0.25;
    const routes = [
      { id: "a", source: "kick" as const, param: spec.key, amount: quarter },
      { id: "b", source: "bass" as const, param: spec.key, amount: quarter },
    ];
    const out = applyMods(preset, base, routes, features({ kick: 1, bass: 1 }));
    const expected = Math.min(spec.max, spec.min + 0.5 * (spec.max - spec.min));
    expect(out[spec.key]).toBeCloseTo(expected, 5);
  });

  it("validates: clamps amounts, drops unknown sources and empty params", () => {
    const routes = validModRoutes([
      { id: "a", source: "kick", param: "x", amount: 99 },
      { id: "b", source: "nope", param: "x", amount: 0.1 },
      { id: "c", source: "bass", param: "", amount: 0.1 },
      "garbage",
    ]);
    expect(routes).toHaveLength(1);
    expect(routes[0].amount).toBe(1);
  });
});
