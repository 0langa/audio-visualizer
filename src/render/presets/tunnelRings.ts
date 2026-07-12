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
  advanced: [
    { key: "cruiseFloor", label: "Cruise floor", min: 0, max: 1, step: 0.02, default: 0.35 },
    { key: "cruiseEnergy", label: "Cruise energy", min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: "beatSpeed", label: "Beat speed kick", min: 0, max: 1, step: 0.02, default: 0.35 },
    { key: "tileLevel", label: "Tile level", min: 0, max: 0.4, step: 0.01, default: 0.1 },
    { key: "tileSpectrum", label: "Tile spectrum", min: 0, max: 1, step: 0.02, default: 0.42 },
    { key: "tileSat", label: "Tile saturation", min: 0, max: 1, step: 0.02, default: 0.75 },
    { key: "checker", label: "Checker contrast", min: 0, max: 0.3, step: 0.01, default: 0.06 },
    { key: "groutWidth", label: "Grout width", min: 0.01, max: 0.2, step: 0.005, default: 0.055 },
    { key: "groutLevel", label: "Grout level", min: 0, max: 0.5, step: 0.01, default: 0.1 },
    { key: "fogNear", label: "Fog near", min: 0.005, max: 0.1, step: 0.005, default: 0.012 },
    { key: "fogFar", label: "Fog reach", min: 0.3, max: 2, step: 0.05, default: 0.7 },
    { key: "centerGlow", label: "Center glow", min: 0, max: 1, step: 0.02, default: 0.2 },
    { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.05, default: 0.3 },
  ],
  wgsl: /* wgsl */ `
fn preset(uv: vec2f) -> vec4f {
  let p = centered(uv);
  let r = length(p) + 1e-3;
  let a = atan2(p.y, p.x);

  // Depth: cruise on the slow envelope, brief kick on beats
  let spd = P_speed() * (P_cruiseFloor() + u.energy * P_cruiseEnergy())
          * (1.0 + u.beatIntensity * P_beatSpeed());
  let z = 0.30 / r + u.time * spd * 5.0;

  // Tile grid in (depth, angle)
  let zq = z * P_rings() * 0.22;
  let ang = fract(a / TAU + 0.5);
  let aq = ang * P_spokes();
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
  let rowHue = P_hue() + fract(cellZ * 0.147) * P_hueSpread();
  let tileL = P_tileLevel() + v * P_tileSpectrum() + checker * P_checker()
            + u.beatIntensity * 0.05;
  var tile = hsl2rgb(rowHue, P_tileSat(), tileL);

  // Grout lines between tiles — light up on beats
  let lz = smoothstep(P_groutWidth(), 0.0, min(fz, 1.0 - fz));
  let la = smoothstep(P_groutWidth() * 1.4, 0.0, min(fa, 1.0 - fa));
  let line = max(lz, la);
  let lineGlow = P_groutLevel() + u.beatIntensity * P_beatFlash() * 0.9;
  tile = mix(tile, hsl2rgb(rowHue + 30.0, 0.5, 0.75), line * lineGlow);

  // Distance fog + center hole
  let fog = smoothstep(P_fogNear(), 0.22, r) * (1.0 - smoothstep(P_fogFar(), 1.25, r));
  var col = hsl2rgb(P_hue() + 60.0, 0.5, 0.025);
  col += tile * fog;

  // Center glow breathes with the envelope, flashes softly on beat
  col += hsl2rgb(P_hue(), 0.8, 0.5) * exp(-r * 10.0)
       * (P_centerGlow() + u.energy * 0.7 + u.beatIntensity * 0.3);

  col *= 1.0 - r * r * P_vignette();
  return vec4f(col, 1.0);
}
`,
};
