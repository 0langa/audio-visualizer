# Contributing

Thanks for looking under the hood. This project is free, open-source, and
GitHub-releases-only — there is no paid tier and never will be, so every
contribution goes straight to users.

## Setup

```
npm install
node scripts/fetch-ffmpeg.mjs   # one-time: ProRes sidecar (~110 MB, not in git)
npm run dev                     # browser dev at localhost:1420 — fastest loop
npm run tauri dev               # full desktop shell (library/loopback/ProRes need this)
```

Gates that must pass before a PR (CI runs all of them):

```
npm run typecheck
npm run lint
npm run format:check
npm test                        # vitest — DSP, schemas, golden traces
(cd src-tauri && cargo test --lib)
```

## The two laws

1. **Determinism.** No `Math.random`, `Date.now`, `performance.now` or any
   wall-clock value may influence a rendered pixel. Grain, particles and
   randomness seed from track time (`u.time`) or frame index. Exports must be
   byte-reproducible run to run.
2. **WYSIWYG.** The live preview and the offline export are the same render.
   Two pure chokepoints enforce it and both paths call them:
   `src/state/frameResolve.ts` (per-frame resolution) and
   `src/export/buildExportOptions.ts` (document → export options). Never
   re-implement either, never read the same state "the same way" somewhere
   else — that is how preview/export drift starts.

PRs that violate either law will be asked to restructure, however nice the
feature is.

## Adding a visual preset

One file in `src/render/presets/` + a registry entry in `index.ts`. Presets
are pure functions of `(features, time, params)` declared as a schema
(`PresetDef`) — the UI generates controls from it. Use the shared WGSL header
helpers (`binAt`, `waveAt`, `gridPulse`, `hsl2rgb`, …); use `u.drive` /
`u.driveBeat` so the Sync panel matters; use `gridPulse()`/`u.beatPhase` for
tempo-locked motion (it falls back to onset pulses when a track has no beat
grid). Ship 5–7 curated styles — structural variety, not just hue swaps.

## Tests

- Pure DSP/model code: unit tests next to the file (`*.test.ts`).
- Sync-critical changes: `src/audio/syncLatency.test.ts` pins beat placement
  against synthetic click tracks — if you touch analysis timing, these tell
  you exactly what moved and every PNG-hash baseline re-records.
- Renderer/preset changes: verified in-browser against the dev probes
  (`window.__store`, `__runExport`, `__gpuErrors`) — see the patterns in
  existing PRs/commits.

## Commits

Conventional commits (`feat:`, `fix:`, `chore:` …) — release notes are
generated from them. Explain _why_ in the body when the change is not
obvious; the codebase's comments follow the same rule.
