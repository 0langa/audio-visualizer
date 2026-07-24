/**
 * Dominant-color analysis of a track's embedded cover art, used by presets
 * that offer "match cover colors" (Bass Circle's coverHue toggle).
 *
 * Pure function of the image pixels: the bitmap is downscaled to a fixed
 * 32x32 grid and reduced with integer bin arithmetic, so the same cover
 * always yields the same palette on every machine. The result feeds ordinary
 * preset params (hue / hueSpread), which live in the project document — so
 * exports and preview agree by construction, and the analysis itself never
 * runs on the render path.
 */

export interface CoverPalette {
  /** Dominant hue in degrees, 0..360. */
  hue: number;
  /** Suggested hue spread in degrees — wide for colorful art, narrow for
   * near-monochrome art. */
  spread: number;
}

const GRID = 32;
const BINS = 36; // 10° hue bins

/** Extract the dominant hue (+ a fitting spread) from cover art. Returns
 * null for effectively grayscale/black covers, where "matching" would just
 * produce noise — callers keep the user's colors in that case. */
export function extractCoverPalette(bmp: ImageBitmap): CoverPalette | null {
  let data: Uint8ClampedArray;
  try {
    const canvas = new OffscreenCanvas(GRID, GRID);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, GRID, GRID);
    data = ctx.getImageData(0, 0, GRID, GRID).data;
  } catch {
    return null; // decode/canvas quirk — behave like "no usable cover"
  }

  // Saturation-weighted hue histogram. Weight favors colorful mid-tones:
  // near-black, near-white and near-gray pixels say nothing about "the
  // color of this cover" and would otherwise drown it in noise.
  const weights = new Float64Array(BINS);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d < 0.08) continue; // gray — no hue information
    const s = d / (1 - Math.abs(2 * l - 1) || 1);
    let h: number;
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    const midtone = 1 - Math.min(1, Math.abs(l - 0.5) * 1.8);
    const w = s * (0.25 + 0.75 * midtone);
    weights[Math.floor(h / (360 / BINS)) % BINS] += w;
    total += w;
  }
  // Under ~6% of pixels carrying color = grayscale art for our purposes.
  if (total < GRID * GRID * 0.06 * 0.2) return null;

  // Peak bin over a smoothed (bin ± neighbors) histogram, then a circular
  // weighted mean over the peak's ±2-bin neighborhood for a stable hue.
  let peak = 0;
  let peakW = -1;
  for (let i = 0; i < BINS; i++) {
    const w = weights[(i + BINS - 1) % BINS] + weights[i] * 2 + weights[(i + 1) % BINS];
    if (w > peakW) {
      peakW = w;
      peak = i;
    }
  }
  let sx = 0;
  let sy = 0;
  for (let k = -2; k <= 2; k++) {
    const i = (peak + k + BINS) % BINS;
    const ang = ((i + 0.5) * (360 / BINS) * Math.PI) / 180;
    sx += Math.cos(ang) * weights[i];
    sy += Math.sin(ang) * weights[i];
  }
  const hue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;

  // Spread from concentration: how much of the total weight sits within the
  // peak neighborhood. Single-color art → tight spread; a rainbow sleeve →
  // wide. Range tuned for the presets' hueSpread sliders (0..240).
  let near = 0;
  for (let k = -3; k <= 3; k++) near += weights[(peak + k + BINS) % BINS];
  const concentration = near / total; // 1 = all color in ±35°
  const spread = Math.round(Math.min(160, Math.max(25, 30 + (1 - concentration) * 180)));

  return { hue: Math.round(hue), spread };
}
