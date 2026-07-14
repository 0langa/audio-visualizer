# Brand

`logo.svg` is the single source of truth for the app's mark: a ring of radial
spectrum bars around a glowing core — the app's own Bass Circle silhouette, in
the violet→cyan palette the UI uses.

It is deliberately chunky (16 bars, wide strokes, tight glow) so the ring still
reads as distinct spokes at 32px in a taskbar or favicon rather than smearing
into a blob.

## Regenerating the icons

Everything downstream is generated from this one file — never hand-edit the
outputs:

```sh
npx tauri icon brand/logo.svg   # -> src-tauri/icons/*  (app + installer icons)
cp brand/logo.svg public/icon.svg   # -> web favicon, referenced by index.html
```

`tauri icon` also emits `android/` and `ios/` icon sets. This is a desktop-only
app and `tauri.conf.json` references only the five desktop icons
(`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`), so
those directories are deleted rather than committed.
