import type { PresetDef } from "../types";

/**
 * Flowing fbm-noise nebula with optional kaleidoscope fold. Bass drives
 * brightness, mids shift color, treble adds sparkle grain; beats launch a
 * ripple ring from the center.
 */
export const nebula: PresetDef = {
  id: "nebula",
  name: "Kaleido Nebula",
  params: [
    { key: "hue", label: "Hue", min: 0, max: 360, step: 1, default: 300 },
    { key: "scale", label: "Scale", min: 0.8, max: 6, step: 0.1, default: 2.4 },
    { key: "flow", label: "Flow speed", min: 0, max: 0.6, step: 0.01, default: 0.12 },
    { key: "kaleido", label: "Kaleido", min: 0, max: 12, step: 1, default: 6 },
    { key: "contrast", label: "Contrast", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "sparkle", label: "Sparkle", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "beatRipple", label: "Beat ripple", min: 0, max: 1, step: 0.01, default: 0.6 },
  ],
  advanced: [
    { key: "warp", label: "Domain warp", min: 0, max: 4, step: 0.1, default: 1.8 },
    { key: "hueRange", label: "Hue range", min: 0, max: 300, step: 5, default: 110 },
    { key: "midHueShift", label: "Mid hue shift", min: 0, max: 200, step: 5, default: 70 },
    { key: "brightFloor", label: "Brightness floor", min: 0, max: 0.6, step: 0.01, default: 0.22 },
    { key: "bassBright", label: "Bass brighten", min: 0, max: 1, step: 0.02, default: 0.45 },
    { key: "saturation", label: "Saturation", min: 0, max: 1, step: 0.02, default: 0.75 },
    { key: "sparkleScale", label: "Sparkle scale", min: 2, max: 30, step: 1, default: 9 },
    { key: "sparkleSharp", label: "Sparkle sharpness", min: 4, max: 40, step: 1, default: 18 },
    { key: "rippleWidth", label: "Ripple width", min: 4, max: 40, step: 1, default: 16 },
    { key: "rippleWarp", label: "Ripple distortion", min: 0, max: 0.3, step: 0.01, default: 0.09 },
    { key: "beatBloom", label: "Beat bloom", min: 0, max: 0.6, step: 0.02, default: 0.18 },
    { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.05, default: 0.35 },
  ],
  wgsl: /* wgsl */ `
fn preset(uv: vec2f) -> vec4f {
  var p = centered(uv);

  // Kaleidoscope fold
  if (P_kaleido() >= 2.0) {
    let r = length(p);
    var ang = atan2(p.y, p.x) + u.time * P_flow() * 0.5;
    let seg = TAU / P_kaleido();
    ang = abs(fract(ang / seg + 10.0) - 0.5) * seg;
    p = vec2f(cos(ang), sin(ang)) * r;
  }

  // Beat ripple: a distortion ring expands from center as beatIntensity
  // decays (1 -> 0 maps to radius 0 -> edge). Makes the sync unmistakable
  // without changing the nebula's character between beats.
  let rp = length(p);
  if (u.beatIntensity > 0.01 && rp > 1e-4) {
    let rippleR = (1.0 - u.beatIntensity) * 1.1;
    let wave = exp(-abs(rp - rippleR) * P_rippleWidth()) * u.beatIntensity * P_beatRipple();
    p += (p / rp) * wave * P_rippleWarp();
  }

  let q = p * P_scale();
  let t = u.time * P_flow();

  // Domain-warped fbm
  let warp = fbm(q + vec2f(t, -t * 0.7));
  let n = fbm(q + vec2f(warp * P_warp()) + vec2f(-t * 0.5, t * 0.9));

  // Contrast shaping; bass lifts the floor
  let sharp = 1.0 + P_contrast() * 3.0;
  let v = pow(clamp(n, 0.0, 1.0), sharp);

  let nebHue = P_hue() + n * P_hueRange() + u.mid * P_midHueShift();
  var col = hsl2rgb(nebHue, P_saturation(), v * (P_brightFloor() + u.bass * P_bassBright()) + 0.02);

  // Treble sparkle grain
  let g = pow(noise2(q * P_sparkleScale() + vec2f(t * 6.0, -t * 4.0)), P_sparkleSharp());
  col += vec3f(1.0, 0.95, 0.9) * g * u.treble * P_sparkle() * 2.0;

  // Beat bloom from center + bright rim tracing the ripple front
  let r2 = length(p);
  col += hsl2rgb(P_hue(), 0.8, 0.55) * u.beatIntensity * P_beatBloom() * exp(-r2 * 3.0);
  if (u.beatIntensity > 0.01) {
    let rippleR2 = (1.0 - u.beatIntensity) * 1.1;
    let rim = exp(-abs(rp - rippleR2) * 20.0) * u.beatIntensity * P_beatRipple();
    col += hsl2rgb(P_hue() + 40.0, 0.7, 0.6) * rim * 0.5;
  }

  col *= 1.0 - dot(p, p) * P_vignette();
  return vec4f(col, 1.0);
}
`,
};
