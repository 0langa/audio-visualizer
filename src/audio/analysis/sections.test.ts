import { describe, expect, it } from "vitest";
import { detectSections } from "./sections";

const SR = 48000;

/** Deterministic pseudo-noise via summed detuned sines (no Math.random). */
function fillTexture(
  out: Float32Array,
  from: number,
  to: number,
  freqs: number[],
  amp: number,
): void {
  for (const f of freqs) {
    for (let i = from; i < to; i++) {
      out[i] += amp * Math.sin((2 * Math.PI * f * i) / SR + f);
    }
  }
}

describe("section detection", () => {
  it("finds the boundary in a two-part track (quiet lows → loud highs)", () => {
    const seconds = 60;
    const data = new Float32Array(SR * seconds);
    fillTexture(data, 0, SR * 30, [110, 165, 220], 0.15); // mellow low half
    fillTexture(data, SR * 30, SR * 60, [2000, 3100, 4400, 6500], 0.4); // bright loud half
    const bounds = detectSections(data, SR);
    expect(bounds.length).toBeGreaterThanOrEqual(1);
    const nearest = bounds.reduce((a, b) => (Math.abs(b - 30) < Math.abs(a - 30) ? b : a));
    expect(Math.abs(nearest - 30)).toBeLessThan(4);
  });

  it("finds two boundaries in a three-part track", () => {
    const seconds = 90;
    const data = new Float32Array(SR * seconds);
    fillTexture(data, 0, SR * 30, [110, 220], 0.2);
    fillTexture(data, SR * 30, SR * 60, [3000, 4500, 6000], 0.45);
    fillTexture(data, SR * 60, SR * 90, [110, 220], 0.2);
    const bounds = detectSections(data, SR);
    expect(bounds.length).toBeGreaterThanOrEqual(2);
    const near30 = bounds.some((b) => Math.abs(b - 30) < 4);
    const near60 = bounds.some((b) => Math.abs(b - 60) < 4);
    expect(near30).toBe(true);
    expect(near60).toBe(true);
  });

  it("reports no boundaries for homogeneous audio", () => {
    const data = new Float32Array(SR * 60);
    fillTexture(data, 0, data.length, [440, 660], 0.3);
    expect(detectSections(data, SR)).toEqual([]);
  });

  it("returns empty for very short tracks", () => {
    const data = new Float32Array(SR * 5);
    fillTexture(data, 0, data.length, [440], 0.3);
    expect(detectSections(data, SR)).toEqual([]);
  });

  it("is deterministic", () => {
    const data = new Float32Array(SR * 40);
    fillTexture(data, 0, SR * 20, [110], 0.2);
    fillTexture(data, SR * 20, SR * 40, [4000, 5000], 0.4);
    expect(detectSections(data, SR)).toEqual(detectSections(data, SR));
  });
});
