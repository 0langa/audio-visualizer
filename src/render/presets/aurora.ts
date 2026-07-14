import type { PresetDef } from "../types";

/**
 * Aurora — layered curtains of light that waver on an fbm flow, brightened by
 * the spectrum, with vertical ray texture. Green-to-violet northern-lights look
 * that sits beautifully over a dark background.
 */
export const aurora: PresetDef = {
  id: "aurora",
  name: "Aurora",
  description:
    "Northern-lights curtains that ripple and glow with the spectrum — slow, ambient, and hypnotic.",
  styles: [
    { id: "boreal", name: "Boreal", values: {} },
    { id: "magenta", name: "Magenta", values: { hue: 300, hueStep: 40, hueSpread: 60 } },
    { id: "ember", name: "Ember", values: { hue: 20, hueStep: 25, hueSpread: 40, bright: 1.2 } },
    { id: "ice", name: "Ice", values: { hue: 180, hueStep: 30, hueSpread: 50, thick: 0.16 } },
  ],
  params: [
    {
      key: "hue",
      label: "Hue",
      min: 0,
      max: 360,
      step: 1,
      default: 140,
      hint: "Base curtain color",
    },
    {
      key: "bright",
      label: "Brightness",
      min: 0.2,
      max: 2,
      step: 0.05,
      default: 1,
      hint: "Overall glow of the curtains",
    },
    {
      key: "flow",
      label: "Flow",
      min: 0,
      max: 3,
      step: 0.05,
      default: 1,
      hint: "How fast the curtains waver",
    },
    {
      key: "thick",
      label: "Thickness",
      min: 0.04,
      max: 0.3,
      step: 0.01,
      default: 0.12,
      hint: "Vertical thickness of each curtain",
    },
    {
      key: "baseY",
      label: "Height",
      min: 0.2,
      max: 0.8,
      step: 0.01,
      default: 0.5,
      hint: "Where the curtains hang on screen",
    },
  ],
  advanced: [
    {
      key: "layers",
      label: "Curtains",
      min: 1,
      max: 3,
      step: 1,
      default: 3,
      hint: "Number of stacked curtains",
    },
    {
      key: "hueStep",
      label: "Hue step",
      min: 0,
      max: 120,
      step: 5,
      default: 55,
      hint: "Color shift between curtains",
    },
    {
      key: "hueSpread",
      label: "Hue spread",
      min: 0,
      max: 180,
      step: 5,
      default: 40,
      hint: "Color drift across the width",
    },
    {
      key: "rays",
      label: "Rays",
      min: 0,
      max: 1,
      step: 0.02,
      default: 0.65,
      hint: "Vertical ray texture strength",
    },
  ],
  wgsl: /* wgsl */ `
fn preset(uv: vec2f) -> vec4f {
  var col = vec3f(0.0);
  let x = uv.x;
  let y = uv.y;
  let layers = i32(P_layers());
  for (var i = 0; i < 3; i++) {
    if (i >= layers) { break; }
    let fi = f32(i);
    let spec = binAt(fract(x * (0.6 + fi * 0.2) + fi * 0.13));
    // Wavy vertical center of this curtain.
    let wob = fbm(vec2f(x * (2.0 + fi) + fi * 7.0, u.time * P_flow() * 0.15 + fi * 3.0));
    let cy = P_baseY() + 0.15 * fi + (wob - 0.5) * 0.35;
    let thick = P_thick() * (0.6 + spec * 1.2);
    let d = (y - cy) / max(thick, 1e-3);
    let band = exp(-d * d);
    // Vertical rays for that shimmering aurora texture.
    let ray = 0.55 + 0.45 * sin(x * (60.0 + fi * 30.0) + fbm(vec2f(x * 8.0, u.time * 0.2)) * 8.0);
    let hue = P_hue() + fi * P_hueStep() + x * P_hueSpread() + spec * 30.0;
    col += hsl2rgb(hue, 0.78, 0.55) * band * (1.0 - P_rays() + ray * P_rays())
         * (0.35 + spec * 1.7) * P_bright();
  }
  // Faint high glow toward the top.
  col += hsl2rgb(P_hue() + 180.0, 0.5, 0.25) * smoothstep(0.9, 0.2, y) * 0.05;
  return vec4f(col, 1.0);
}
`,
};
