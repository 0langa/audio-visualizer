import type { PresetDef } from "../types";

/**
 * Retro LED spectrum matrix: quantized cells lighting bottom-up per column,
 * classic green->yellow->red gradient (hue-shiftable), peak-hold dot per
 * column.
 */
export const ledMatrix: PresetDef = {
  id: "led-matrix",
  name: "LED Matrix",
  params: [
    { key: "cols", label: "Columns", min: 16, max: 96, step: 1, default: 48 },
    { key: "rows", label: "Rows", min: 8, max: 48, step: 1, default: 24 },
    { key: "gap", label: "Cell gap", min: 0.05, max: 0.5, step: 0.01, default: 0.18 },
    { key: "hueShift", label: "Hue shift", min: 0, max: 360, step: 1, default: 0 },
    { key: "dim", label: "Unlit glow", min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: "rounded", label: "Rounded", min: 0, max: 1, step: 1, default: 1 },
    { key: "peaks", label: "Peak dots", min: 0, max: 1, step: 1, default: 1 },
  ],
  advanced: [
    { key: "hueLow", label: "Low hue", min: 0, max: 360, step: 1, default: 120 },
    { key: "hueHigh", label: "High hue", min: 0, max: 360, step: 1, default: 0 },
    { key: "gradStart", label: "Gradient start", min: 0, max: 1, step: 0.02, default: 0.45 },
    { key: "gradEnd", label: "Gradient end", min: 0.3, max: 1, step: 0.02, default: 0.92 },
    { key: "litLevel", label: "Lit brightness", min: 0.2, max: 0.8, step: 0.02, default: 0.45 },
    { key: "hotBoost", label: "Top-cell boost", min: 0, max: 0.4, step: 0.02, default: 0.15 },
    { key: "unlitLevel", label: "Unlit level", min: 0, max: 0.2, step: 0.01, default: 0.05 },
    { key: "beatBoost", label: "Beat boost", min: 0, max: 0.3, step: 0.01, default: 0.08 },
    { key: "peakBright", label: "Peak brightness", min: 0.3, max: 1.2, step: 0.05, default: 0.85 },
    { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
  wgsl: /* wgsl */ `
fn ledCell(l: vec2f, gap: f32, rounded: f32) -> f32 {
  let c = l - 0.5;
  if (rounded > 0.5) {
    let d = length(c);
    return smoothstep(0.5 - gap * 0.5, 0.35 - gap * 0.5, d);
  }
  let e = vec2f(0.5 - gap * 0.5);
  let m = step(abs(c), e);
  return m.x * m.y;
}

fn preset(uv: vec2f) -> vec4f {
  let cols = max(4.0, P_cols());
  let rows = max(4.0, P_rows());

  let cx = floor(uv.x * cols);
  let lx = fract(uv.x * cols);
  let yb = 1.0 - uv.y;
  let cy = floor(yb * rows);
  let ly = fract(yb * rows);

  let v = binAt((cx + 0.5) / cols);
  let pk = peakAt((cx + 0.5) / cols);

  let level = v * rows;
  let lit = step(cy + 0.5, level);
  let frac = (cy + 0.5) / rows;

  // low hue -> high hue as cells climb (default classic green -> red)
  let cellHue = mix(P_hueLow(), P_hueHigh(), smoothstep(P_gradStart(), P_gradEnd(), frac))
              + P_hueShift();

  let mask = ledCell(vec2f(lx, ly), P_gap(), P_rounded());

  var col = vec3f(0.008, 0.01, 0.012); // panel background
  // Unlit LEDs faintly visible
  col += hsl2rgb(cellHue, 0.6, P_unlitLevel()) * mask * P_dim() * (1.0 - lit);
  // Lit LEDs, brighter near the top of the column's level
  let hot = P_litLevel() + P_hotBoost() * smoothstep(level - 2.0, level, cy + 0.5)
          + u.beatIntensity * P_beatBoost();
  col += hsl2rgb(cellHue, 0.9, hot) * mask * lit;

  // Peak-hold dot (toggleable)
  let pkRow = floor(pk * rows);
  if (cy == pkRow && pk > 0.02 && P_peaks() > 0.5) {
    col += hsl2rgb(P_hueShift() + 10.0, 0.4, P_peakBright()) * mask;
  }

  // Subtle screen curvature vignette
  let d = distance(uv, vec2f(0.5));
  col *= 1.0 - d * d * P_vignette();
  return vec4f(col, 1.0);
}
`,
};
