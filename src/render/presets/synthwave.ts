import type { PresetDef } from "../types";

/**
 * Synthwave — a retro perspective grid floor streaming toward a scanline sun,
 * with a bass-glowing horizon. Below the horizon a projected grid recedes;
 * above it, a banded sun and sky gradient. A staple '80s look.
 */
export const synthwave: PresetDef = {
  id: "synthwave",
  name: "Synthwave",
  description:
    "Retro neon grid racing toward a scanline sun — the grid pulses with the bass, the sun glows on the horizon.",
  styles: [
    { id: "sunset", name: "Sunset", values: {} },
    { id: "miami", name: "Miami", values: { hue: 320, gridHue: 190 } },
    { id: "toxic", name: "Toxic", values: { hue: 90, gridHue: 140, speed: 1.6 } },
    { id: "vapor", name: "Vapor", values: { hue: 285, gridHue: 300, sunR: 0.34, speed: 0.5 } },
  ],
  params: [
    {
      key: "hue",
      label: "Sun hue",
      min: 0,
      max: 360,
      step: 1,
      default: 20,
      hint: "Sun / sky color",
    },
    {
      key: "gridHue",
      label: "Grid hue",
      min: 0,
      max: 360,
      step: 1,
      default: 300,
      hint: "Color of the neon floor grid",
    },
    {
      key: "speed",
      label: "Speed",
      min: 0,
      max: 3,
      step: 0.05,
      default: 1,
      hint: "How fast the grid races toward you",
    },
    {
      key: "sunR",
      label: "Sun size",
      min: 0.1,
      max: 0.4,
      step: 0.01,
      default: 0.28,
      hint: "Radius of the sun",
    },
    {
      key: "gridGlow",
      label: "Grid glow",
      min: 0,
      max: 2,
      step: 0.05,
      default: 1,
      hint: "Brightness of the grid — bass pumps it further",
    },
  ],
  advanced: [
    {
      key: "sunY",
      label: "Sun height",
      min: 0.1,
      max: 0.45,
      step: 0.01,
      default: 0.3,
      hint: "Vertical position of the sun above the horizon",
    },
    {
      key: "gridScale",
      label: "Grid density",
      min: 0.2,
      max: 2,
      step: 0.05,
      default: 0.7,
      hint: "How fine the grid columns are",
    },
    {
      key: "scan",
      label: "Sun scanlines",
      min: 0,
      max: 1,
      step: 0.02,
      default: 0.6,
      hint: "Strength of the horizontal bands across the sun",
    },
  ],
  wgsl: /* wgsl */ `
fn preset(uv: vec2f) -> vec4f {
  var col = vec3f(0.0);
  let cx = (uv.x - 0.5) * u.aspect;
  let horizon = 0.5;
  if (uv.y > horizon) {
    // --- Floor: perspective grid receding to the horizon.
    let fy = uv.y - horizon;                 // 0 at horizon .. 0.5 at bottom
    let persp = 0.16 / max(fy, 0.004);
    let gz = persp - u.time * P_speed() * 2.0;
    let gx = cx * persp * P_gridScale();
    let lz = abs(fract(gz) - 0.5);
    let lx = abs(fract(gx) - 0.5);
    let lineW = 0.035 + fy * 0.12;
    let grid = smoothstep(lineW, 0.0, lz) + smoothstep(lineW, 0.0, lx);
    let fade = smoothstep(0.0, 0.12, fy);
    col += hsl2rgb(P_gridHue(), 0.9, 0.55) * grid * fade * P_gridGlow() * (0.5 + u.bass * 1.5);
  } else {
    // --- Sky: banded sun + gradient.
    let sd = length(vec2f(cx, uv.y - (horizon - P_sunY())));
    let sunBody = smoothstep(P_sunR(), P_sunR() - 0.008, sd);
    let scanline = 1.0 - P_scan() * step(0.5, fract((horizon - uv.y) * 55.0 - 0.2));
    let sunGrad = mix(
      hsl2rgb(P_hue() + 45.0, 0.95, 0.6),
      hsl2rgb(P_hue(), 0.95, 0.55),
      clamp((uv.y - (horizon - P_sunY() - P_sunR())) / (2.0 * P_sunR()), 0.0, 1.0),
    );
    col += sunGrad * sunBody * scanline;
    col += hsl2rgb(P_hue() + 30.0, 0.8, 0.45) * smoothstep(P_sunR() * 2.2, 0.0, sd) * 0.35;
    // Sky gradient darkening upward.
    col += hsl2rgb(P_hue() + 60.0, 0.6, 0.12) * (horizon - uv.y) * 1.2;
  }
  // Horizon bloom line, brightened by loudness.
  col += hsl2rgb(P_gridHue(), 0.8, 0.6) * exp(-abs(uv.y - horizon) * 60.0) * (0.4 + u.energy * 0.6);
  return vec4f(col, 1.0);
}
`,
};
