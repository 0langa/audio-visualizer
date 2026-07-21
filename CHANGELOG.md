# Changelog

All notable changes to Beatform are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is
pragmatic rather than strict semver: a feature release bumps MINOR, a
fix-only release bumps PATCH. Entries below are derived from the project's
own commit history (`git log` + tags), oldest tag first reversed to newest.

Beatform is free and open source (MIT), distributed only through GitHub
Releases — there is no paid tier, cloud service, or telemetry.

## [Unreleased]

Ongoing hardening pass across the render/export/state layers, CI and
repository documentation, following an internal code audit. Will land as a
tagged release once complete.

## [2.34.1] - 2026-07-20

### Fixed

- Hard circular edge on Radial Burst / Voice Orb — removed a full-field edge
  fade that carved a visible circle.

## [2.34.0] - 2026-07-19

### Added

- Karaoke-style word-wipe animation for timed lyrics.

## [2.33.0] - 2026-07-19

### Added

- Stage mode (`\`): chrome-free full-bleed output with a blackout toggle and
  a mode-name HUD, for live performance.

## [2.32.0] - 2026-07-19

### Added

- Web MIDI control — map CC messages to any parameter and notes to mode
  switches (local, no drivers).

## [2.31.0] - 2026-07-19

### Added

- Video background blur.
- Lyric entry animations.

### Changed

- Accessibility closeout pass (loop-button labeling, modal close-button
  labels).

## [2.30.0] - 2026-07-18

### Added

- Beat-quantized hotkey preset switching — a mode switch lands on the next
  beat/bar instead of taking effect instantly.

## [2.29.1] - 2026-07-18

### Changed

- Timeline keyframes are keyboard-operable.
- Preset strip is memoized.
- Theme colors moved to CSS variables.

## [2.29.0] - 2026-07-18

### Added

- Per-mode "master" control gating and unified controls.
- Keyboard accessibility pass on settings controls.

### Fixed

- Nine dead, redundant, or miscalibrated preset parameters recalibrated.

### Changed

- Reduced hot-path allocations; debounced settings persistence.

## [2.28.3] - 2026-07-18

### Fixed

- Spectrum display dynamics expanded so bars spike instead of bunching
  together.

## [2.28.2] - 2026-07-18

### Fixed

- Audit-fix pass: frame safety, export segment fidelity, ffmpeg sidecar
  cleanup.

## [2.28.1] - 2026-07-17

### Fixed

- Spectrum headroom and frame-safe geometry for Voice Orb and Bass Circle.

## [2.28.0] - 2026-07-17

### Added

- Looped video backgrounds (desktop) — decoded deterministically by track
  time so exports match the preview.

## [2.27.0] - 2026-07-17

### Added

- Scene transition library for the timeline.

## [2.26.0] - 2026-07-17

### Added

- Audiogram overlay elements, via a unified dynamic-overlay compositor.
- Auto-arrange timeline scenes from detected song sections.
- One-click stem auto-routing to the active visual.

## [2.25.0] - 2026-07-17

### Added

- Timed lyric overlays from `.lrc` / `.srt` files.

## [2.24.0] - 2026-07-17

### Added

- GIF and animated WebP loop export via the bundled ffmpeg sidecar.

### Fixed

- Eight defects from a pre-v3.0 adversarial audit, plus fifteen more from a
  second wave covering the remaining surfaces.

## [2.23.0] - 2026-07-16

### Added

- Transparent WebM export (VP9 + real alpha channel) via mediabunny.

## [2.22.0] - 2026-07-16

### Added

- In-app WGSL shader editor — write and preview your own visual, no build
  tools required.

## [2.21.0] - 2026-07-16

### Added

- Import stems as modulation sources.

## [2.20.0] - 2026-07-16

### Added

- Live-rendered preset thumbnails in the mode strip.

## [2.19.0] - 2026-07-16

### Added

- Image backgrounds — artwork behind the visualization (project schema v7).

## [2.18.0] - 2026-07-16

### Changed

- Rebranded the project to **Beatform**.

### Added

- Public documentation site (GitHub Pages): user guide, preset SDK, template
  spec.

## [2.17.0] - 2026-07-16

### Added

- `.avtheme` templates — shareable looks, factory packs, drag-to-import.

## [2.16.0] - 2026-07-16

### Added

- ProRes 4444 export with alpha via a bundled ffmpeg sidecar (desktop).

## [2.15.0] - 2026-07-16

### Added

- "Listen to the system" — visualize system audio via WASAPI loopback
  (desktop), analysis-only.

## [2.14.0] - 2026-07-16

### Added

- Music library sidebar: folder scan, real tags via lofty, near-gapless
  auto-advance.

## [2.13.0] - 2026-07-15

### Added

- HEVC and AV1 export via a WebCodecs hardware-capability probe.

## [2.12.0] - 2026-07-15

### Fixed

- Beats now land on the audible transient in every sync path.
- Twenty defects from an adversarial audit of the state/render/UI layers.

### Added

- Tempo-grid sync in every visual mode, additional factory style libraries,
  Builder pulse rings.

## [2.11.2] - 2026-07-15

### Fixed

- Bass Circle album art was rendering upside down.

## [2.11.1] - 2026-07-14

### Fixed

- Fourteen defects found by adversarially reviewing the 2.11.0 batch-render
  feature.

## [2.11.0] - 2026-07-14

### Added

- Batch render: drop in a folder of tracks, get one titled video per track,
  unattended — titles read from each file's own ID3 tags.

## [2.10.1] - 2026-07-14

### Fixed

- Export failures were being silently swallowed instead of surfaced.

## [2.10.0] - 2026-07-14

### Added

- App logo and icon set.
- LUFS-normalized export audio with a look-ahead true-peak limiter.

## [2.9.0] - 2026-07-14

### Added

- PNG image-sequence export with alpha.

## [2.8.0] - 2026-07-14

### Added

- Album art in Bass Circle via a cover-art texture in the preset ABI.
- Global "Spectrum smooth" motion master.

## [2.7.0] - 2026-07-14

### Added

- Bass Circle preset — trap-nation-style circular visualizer.

## [2.6.1] - 2026-07-14

### Added

- Independent Attack/Release smoothing for sync sources.

## [2.6.0] - 2026-07-14

### Added

- Global Rotation / Pulse / Detail motion masters across all visual modes.

## [2.5.1] - 2026-07-14

### Fixed

- Aurora seam artifact; sync reactivity on newer modes.

### Added

- Richer controls for the newer render modes.

## [2.5.0] - 2026-07-14

### Added

- "Visual Ceiling": HDR post-processing stack, feedback/trails buffer (Echo
  Trails preset), GPU compute-particle system (Particle Flow), a 3D render
  pass (Spectrum Scape), and the Aurora and Synthwave presets.

## [2.0.2] - 2026-07-14

### Fixed

- Export hang, crossfade ordering, fps/beat-grid mismatch, mono LUFS
  computation.

## [2.0.1] - 2026-07-14

### Fixed

- WYSIWYG/state bugs from the v2.0 review: a shared per-frame resolver, the
  export worker/inline fallback, timeline drag correctness, cached-settings
  validation.

## [2.0.0] - 2026-07-13

### Added

- "Workstation": timeline with scenes, crossfade transitions, keyframe
  automation lanes, undo/redo, autosave.

## [1.7.0] - 2026-07-13

### Added

- Musical sync: beat-grid tempo tracking, kick/snare/hat onset classes,
  musical key detection, section-boundary markers, modulation matrix.

## [1.5.0] - 2026-07-13

### Added

- Overlay layers (text / logo / album art), multi-aspect frames, Spotify
  Canvas seamless-loop export, stereo-width feature, BS.1770 LUFS metering.

## [1.3.0] - 2026-07-13

### Added

- Foundations: zustand state store, `.avproj` project files, `.avpreset`
  user looks, worker-based export pipeline with streaming-to-disk, tests and
  CI.

## [1.2.0] - 2026-07-13

### Added

- Sync-source system — choose what the visuals react to.

## [1.1.0] - 2026-07-13

### Changed

- Starfield rewritten as the Particles preset ("Fly" mode).

## [1.0.0] - 2026-07-13

### Fixed

- Verification hardening pass across the v0.9.0 surface.

## [0.9.0] - 2026-07-12

Initial public release.

### Added

- Tauri + WebGPU audio visualizer scaffold with an initial visual preset
  library, including Voice Orb and Builder mode.
- Deterministic offline MP4 export.
- Advanced settings (every internal preset constant tunable).
- Onboarding UI, keyboard shortcuts, auto-hiding chrome.
- Three synthesized demo tracks.

[Unreleased]: https://github.com/0langa/beatform/compare/v2.34.1...HEAD
[2.34.1]: https://github.com/0langa/beatform/compare/v2.34.0...v2.34.1
[2.34.0]: https://github.com/0langa/beatform/compare/v2.33.0...v2.34.0
[2.33.0]: https://github.com/0langa/beatform/compare/v2.32.0...v2.33.0
[2.32.0]: https://github.com/0langa/beatform/compare/v2.31.0...v2.32.0
[2.31.0]: https://github.com/0langa/beatform/compare/v2.30.0...v2.31.0
[2.30.0]: https://github.com/0langa/beatform/compare/v2.29.1...v2.30.0
[2.29.1]: https://github.com/0langa/beatform/compare/v2.29.0...v2.29.1
[2.29.0]: https://github.com/0langa/beatform/compare/v2.28.3...v2.29.0
[2.28.3]: https://github.com/0langa/beatform/compare/v2.28.2...v2.28.3
[2.28.2]: https://github.com/0langa/beatform/compare/v2.28.1...v2.28.2
[2.28.1]: https://github.com/0langa/beatform/compare/v2.28.0...v2.28.1
[2.28.0]: https://github.com/0langa/beatform/compare/v2.27.0...v2.28.0
[2.27.0]: https://github.com/0langa/beatform/compare/v2.26.0...v2.27.0
[2.26.0]: https://github.com/0langa/beatform/compare/v2.25.0...v2.26.0
[2.25.0]: https://github.com/0langa/beatform/compare/v2.24.0...v2.25.0
[2.24.0]: https://github.com/0langa/beatform/compare/v2.23.0...v2.24.0
[2.23.0]: https://github.com/0langa/beatform/compare/v2.22.0...v2.23.0
[2.22.0]: https://github.com/0langa/beatform/compare/v2.21.0...v2.22.0
[2.21.0]: https://github.com/0langa/beatform/compare/v2.20.0...v2.21.0
[2.20.0]: https://github.com/0langa/beatform/compare/v2.19.0...v2.20.0
[2.19.0]: https://github.com/0langa/beatform/compare/v2.18.0...v2.19.0
[2.18.0]: https://github.com/0langa/beatform/compare/v2.17.0...v2.18.0
[2.17.0]: https://github.com/0langa/beatform/compare/v2.16.0...v2.17.0
[2.16.0]: https://github.com/0langa/beatform/compare/v2.15.0...v2.16.0
[2.15.0]: https://github.com/0langa/beatform/compare/v2.14.0...v2.15.0
[2.14.0]: https://github.com/0langa/beatform/compare/v2.13.0...v2.14.0
[2.13.0]: https://github.com/0langa/beatform/compare/v2.12.0...v2.13.0
[2.12.0]: https://github.com/0langa/beatform/compare/v2.11.2...v2.12.0
[2.11.2]: https://github.com/0langa/beatform/compare/v2.11.1...v2.11.2
[2.11.1]: https://github.com/0langa/beatform/compare/v2.11.0...v2.11.1
[2.11.0]: https://github.com/0langa/beatform/compare/v2.10.1...v2.11.0
[2.10.1]: https://github.com/0langa/beatform/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/0langa/beatform/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/0langa/beatform/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/0langa/beatform/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/0langa/beatform/compare/v2.6.1...v2.7.0
[2.6.1]: https://github.com/0langa/beatform/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/0langa/beatform/compare/v2.5.1...v2.6.0
[2.5.1]: https://github.com/0langa/beatform/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/0langa/beatform/compare/v2.0.2...v2.5.0
[2.0.2]: https://github.com/0langa/beatform/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/0langa/beatform/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/0langa/beatform/compare/v1.7.0...v2.0.0
[1.7.0]: https://github.com/0langa/beatform/compare/v1.5.0...v1.7.0
[1.5.0]: https://github.com/0langa/beatform/compare/v1.3.0...v1.5.0
[1.3.0]: https://github.com/0langa/beatform/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/0langa/beatform/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/0langa/beatform/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/0langa/beatform/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/0langa/beatform/releases/tag/v0.9.0
