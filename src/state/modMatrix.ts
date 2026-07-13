import type { AudioFeatures } from "../audio/types";
import type { PresetDef } from "../render/types";
import { allParams, type ParamValues } from "../render/types";

/**
 * Modulation matrix: route any audio feature to any numeric parameter of the
 * active visual. Routes are part of the document (saved per preset in
 * projects); evaluation is a pure function applied identically per frame in
 * the live loop and in the export loop — WYSIWYG holds.
 *
 * amount is -1..1 and scales against the target's spec range: +1 adds the
 * full range at feature=1, -0.5 subtracts half of it, etc. Results clamp to
 * the spec range.
 */
export interface ModRoute {
  id: string;
  source: ModSource;
  /** Target param key of the active preset. */
  param: string;
  /** -1..1 — fraction of the param's range added at feature value 1. */
  amount: number;
}

export type ModSource =
  | "drive"
  | "driveBeat"
  | "rms"
  | "energy"
  | "bass"
  | "mid"
  | "treble"
  | "voice"
  | "kick"
  | "snare"
  | "hat"
  | "width"
  | "beatPhase"
  | "barPhase";

export const MOD_SOURCES: Array<{ id: ModSource; label: string }> = [
  { id: "drive", label: "Drive" },
  { id: "driveBeat", label: "Drive pulse" },
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "hat", label: "Hats" },
  { id: "bass", label: "Bass" },
  { id: "mid", label: "Mids" },
  { id: "treble", label: "Treble" },
  { id: "voice", label: "Voice" },
  { id: "rms", label: "Loudness" },
  { id: "energy", label: "Energy" },
  { id: "width", label: "Stereo width" },
  { id: "beatPhase", label: "Beat phase" },
  { id: "barPhase", label: "Bar phase" },
];

const SOURCE_IDS = new Set(MOD_SOURCES.map((s) => s.id));

export function newRouteId(): string {
  return `mr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sourceValue(features: AudioFeatures, source: ModSource): number {
  return features[source];
}

/**
 * Apply routes over base params. Pure; returns base unchanged (same object)
 * when there are no routes, so the per-frame hot path stays allocation-free
 * in the common case.
 */
export function applyMods(
  preset: PresetDef,
  base: ParamValues,
  routes: ModRoute[],
  features: AudioFeatures,
): ParamValues {
  if (routes.length === 0) return base;
  const specs = allParams(preset);
  const out: ParamValues = { ...base };
  for (const route of routes) {
    const spec = specs.find((s) => s.key === route.param);
    if (!spec) continue; // route to a param this preset doesn't have — skip
    const value = sourceValue(features, route.source);
    const range = spec.max - spec.min;
    const next = (out[route.param] ?? spec.default) + value * route.amount * range;
    out[route.param] = Math.min(spec.max, Math.max(spec.min, next));
  }
  return out;
}

/** Validate an unknown blob into clean routes (project files, localStorage). */
export function validModRoutes(v: unknown): ModRoute[] {
  if (!Array.isArray(v)) return [];
  const out: ModRoute[] = [];
  for (const raw of v) {
    const r = raw as Partial<ModRoute>;
    if (
      typeof r === "object" &&
      r !== null &&
      typeof r.id === "string" &&
      typeof r.source === "string" &&
      SOURCE_IDS.has(r.source as ModSource) &&
      typeof r.param === "string" &&
      r.param.length > 0 &&
      typeof r.amount === "number" &&
      Number.isFinite(r.amount)
    ) {
      out.push({
        id: r.id,
        source: r.source as ModSource,
        param: r.param.slice(0, 64),
        amount: Math.min(1, Math.max(-1, r.amount)),
      });
    }
  }
  return out;
}

export function validModsByPreset(v: unknown): Record<string, ModRoute[]> {
  if (typeof v !== "object" || v === null) return {};
  const out: Record<string, ModRoute[]> = {};
  for (const [presetId, routes] of Object.entries(v)) {
    const clean = validModRoutes(routes);
    if (clean.length > 0) out[presetId] = clean;
  }
  return out;
}
