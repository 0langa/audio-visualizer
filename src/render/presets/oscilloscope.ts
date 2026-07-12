import type { PresetDef } from "../types";

/**
 * Time-domain oscilloscope. The pipeline phase-aligns the waveform to a
 * rising zero-crossing (real-scope trigger), so the trace stands still
 * instead of flickering. "Calm" spatially smooths the trace; auto-gain rides
 * the slow energy envelope so loud passages don't blow up the display.
 */
export const oscilloscope: PresetDef = {
  id: "oscilloscope",
  name: "Oscilloscope",
  params: [
    { key: "hue", label: "Hue", min: 0, max: 360, step: 1, default: 160 },
    { key: "gain", label: "Gain", min: 0.2, max: 2, step: 0.05, default: 0.9 },
    { key: "calm", label: "Calm", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "glow", label: "Glow", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "fill", label: "Fill", min: 0, max: 1, step: 1, default: 1 },
    { key: "mirror", label: "Mirror", min: 0, max: 1, step: 1, default: 1 },
  ],
  wgsl: /* wgsl */ `
// Smoothed waveform sample: box blur over +/-4 taps scaled by calm
fn calmWave(x: f32, calm: f32) -> f32 {
  let spread = calm * 0.012;
  var s = waveAt(x) * 0.30;
  s += (waveAt(x - spread) + waveAt(x + spread)) * 0.22;
  s += (waveAt(x - spread * 2.0) + waveAt(x + spread * 2.0)) * 0.13;
  return s;
}

fn preset(uv: vec2f) -> vec4f {
  let hue = param(0); let gainP = param(1); let calm = param(2);
  let glow = param(3); let fill = param(4); let mirror = param(5);

  // Auto-gain: normalize display height against the slow envelope, so quiet
  // and loud passages fill a similar, stable portion of the screen.
  let gain = gainP / (0.35 + u.energy * 1.4);

  // Background: near-black, subtle bass tint, faint grid
  var col = hsl2rgb(hue + 40.0, 0.4, 0.028 + u.bass * 0.02);
  let gx = smoothstep(0.004, 0.0, abs(fract(uv.x * 8.0) - 0.5) * 0.25);
  let gy = smoothstep(0.004, 0.0, abs(fract(uv.y * 6.0) - 0.5) * 0.25);
  col += hsl2rgb(hue, 0.3, 0.25) * (gx + gy) * 0.06;
  // Center line
  col += hsl2rgb(hue, 0.3, 0.3) * smoothstep(0.0015, 0.0, abs(uv.y - 0.5)) * 0.3;

  let w = calmWave(uv.x, calm) * gain;
  let amp = clamp(w * 0.34, -0.44, 0.44);
  let y = 0.5 + amp;

  // Main trace: crisp core + soft neon glow
  let d = abs(uv.y - y);
  let traceHue = hue + w * 24.0;
  col += hsl2rgb(traceHue, 0.85, 0.62) * smoothstep(0.0035, 0.0008, d);
  col += hsl2rgb(traceHue, 0.9, 0.5) * exp(-d * (110.0 - glow * 70.0)) * (0.35 + glow * 0.55);

  // Mirrored ghost trace (dimmer, hue-shifted)
  if (mirror > 0.5) {
    let ym = 0.5 - amp;
    let dm = abs(uv.y - ym);
    col += hsl2rgb(traceHue + 30.0, 0.7, 0.5) * exp(-dm * 160.0) * 0.35;
  }

  // Soft fill from trace toward the center line
  if (fill > 0.5) {
    let between = step(min(y, 0.5), uv.y) * step(uv.y, max(y, 0.5));
    let fade = 1.0 - abs(uv.y - 0.5) / max(abs(amp), 0.001);
    col += hsl2rgb(traceHue, 0.7, 0.4) * between * clamp(fade, 0.0, 1.0) * 0.16;
  }

  // Gentle beat lift (no strobe)
  col *= 1.0 + u.beatIntensity * 0.10;

  let d2 = distance(uv, vec2f(0.5));
  col *= 1.0 - d2 * d2 * 0.55;
  return vec4f(col, 1.0);
}
`,
};
