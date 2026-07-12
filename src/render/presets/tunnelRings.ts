import type { PresetDef } from "../types";

/**
 * Structured tunnel: the wall is a grid of spoke x ring tiles (checkerboard
 * shaded) so depth motion is readable. The spectrum lights tiles at their
 * angle, beats flash the grout lines and kick the speed — the sync is
 * explicit, not ambient.
 */
export const tunnelRings: PresetDef = {
  id: "tunnel-rings",
  name: "Tunnel",
  params: [
    { key: "hue", label: "Hue", min: 0, max: 360, step: 1, default: 15 },
    { key: "hueSpread", label: "Hue spread", min: 0, max: 240, step: 1, default: 70 },
    { key: "speed", label: "Speed", min: 0.05, max: 1, step: 0.05, default: 0.25 },
    { key: "rings", label: "Ring density", min: 3, max: 14, step: 0.5, default: 7 },
    { key: "spokes", label: "Spokes", min: 4, max: 24, step: 2, default: 12 },
    { key: "beatFlash", label: "Beat flash", min: 0, max: 1, step: 0.01, default: 0.6 },
  ],
  wgsl: /* wgsl */ `
fn preset(uv: vec2f) -> vec4f {
  let hue = param(0); let hueSpread = param(1); let speed = param(2);
  let rings = param(3); let spokes = param(4); let beatFlash = param(5);

  let p = centered(uv);
  let r = length(p) + 1e-3;
  let a = atan2(p.y, p.x);

  // Depth: cruise on the slow envelope, brief kick on beats
  let spd = speed * (0.35 + u.energy * 0.9) * (1.0 + u.beatIntensity * 0.35);
  let z = 0.30 / r + u.time * spd * 5.0;

  // Tile grid in (depth, angle)
  let zq = z * rings * 0.22;
  let ang = fract(a / TAU + 0.5);
  let aq = ang * spokes;
  let cellZ = floor(zq);
  let cellA = floor(aq);
  let fz = fract(zq);
  let fa = fract(aq);

  // Spectrum at this angle (mirrored for seamless wrap)
  let xs = abs(ang * 2.0 - 1.0);
  let v = binAt(xs);

  // Checkerboard shade so rows visibly march toward the viewer
  let checker = f32((i32(cellZ) + i32(cellA)) % 2);

  // Tile color: hue banded per ring row, brightness driven by the spectrum
  let rowHue = hue + fract(cellZ * 0.147) * hueSpread;
  let tileL = 0.10 + v * 0.42 + checker * 0.06 + u.beatIntensity * 0.05;
  var tile = hsl2rgb(rowHue, 0.75, tileL);

  // Grout lines between tiles — light up on beats
  let lineW = 0.055;
  let lz = smoothstep(lineW, 0.0, min(fz, 1.0 - fz));
  let la = smoothstep(lineW * 1.4, 0.0, min(fa, 1.0 - fa));
  let line = max(lz, la);
  let lineGlow = 0.10 + u.beatIntensity * beatFlash * 0.9;
  tile = mix(tile, hsl2rgb(rowHue + 30.0, 0.5, 0.75), line * lineGlow);

  // Distance fog + center hole
  let fog = smoothstep(0.012, 0.22, r) * (1.0 - smoothstep(0.7, 1.25, r));
  var col = hsl2rgb(hue + 60.0, 0.5, 0.025);
  col += tile * fog;

  // Center glow breathes with the envelope, flashes softly on beat
  col += hsl2rgb(hue, 0.8, 0.5) * exp(-r * 10.0) * (0.2 + u.energy * 0.7 + u.beatIntensity * 0.3);

  col *= 1.0 - r * r * 0.3;
  return vec4f(col, 1.0);
}
`,
};
