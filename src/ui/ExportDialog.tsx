import {
  autoBitrateMbps,
  LOUDNESS_PRESETS,
  RESOLUTIONS,
  resolutionsForAspect,
  useVizStore,
} from "../state/store";
import { CODEC_LABELS, type VideoCodecId } from "../export/codecProbe";
import { BG_TRANSPARENT } from "../render/types";
import { isTauri } from "../state/platform";
import { Slider } from "./Slider";
import { Switch } from "./Switch";
import { useFocusTrap } from "./useFocusTrap";
import { IconClose, IconExport } from "./Icons";

const CODEC_IDS: readonly VideoCodecId[] = ["h264", "hevc", "av1", "vp9a"];

/**
 * The Export modal, extracted whole from App.tsx (it was ~330 lines and five
 * subscriptions inside the app shell). Subscribes to the store directly —
 * it is an app-level modal, not a memoized leaf panel, so the props-only
 * rule for panels deliberately does not apply. The caller gates mounting on
 * `showExport`, so every subscription here costs nothing while closed.
 */
export function ExportDialog() {
  const exportSettings = useVizStore((s) => s.exportSettings);
  const exporting = useVizStore((s) => s.exporting);
  const exportError = useVizStore((s) => s.exportError);
  const exportDone = useVizStore((s) => s.exportDone);
  const aspect = useVizStore((s) => s.aspect);
  const bg = useVizStore((s) => s.bg);
  const codecSupport = useVizStore((s) => s.codecSupport);
  const duration = useVizStore((s) => s.playback.duration);
  const store = useVizStore.getState;

  const dialogRef = useFocusTrap(true);
  const codecChoices = CODEC_IDS.filter((c) => codecSupport?.[c]);

  const canvasMode = exportSettings.mode === "canvas";
  const res = canvasMode ? { w: 1080, h: 1920 } : RESOLUTIONS[exportSettings.resIdx];
  const effFps = canvasMode ? 30 : exportSettings.fps;
  const effectiveMbps = exportSettings.autoRate
    ? autoBitrateMbps(res.w, res.h, effFps)
    : exportSettings.manualMbps;
  const canvasMaxStart = Math.max(0, duration - exportSettings.canvasDuration);
  const exportPct = exporting
    ? Math.round((exporting.done / Math.max(1, exporting.total)) * 100)
    : 0;
  const exportSpeed = exporting?.speed != null ? exporting.speed.toFixed(0) : null;

  return (
    <div className="modal-backdrop" onClick={() => !exporting && store().setShowExport(false)}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Export video"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <span className="panel-heading">Export video</span>
          <button
            className="icon-btn subtle"
            disabled={!!exporting}
            aria-label="Close"
            title={exporting ? "Export in progress…" : "Close"}
            onClick={() => store().setShowExport(false)}
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="field">
          <span>Type</span>
          <div className="segmented">
            <button
              className={`segment ${!canvasMode ? "active" : ""}`}
              disabled={!!exporting}
              title="Export the whole track as a video"
              onClick={() => store().setExportSettings({ mode: "video" })}
            >
              Video
            </button>
            <button
              className={`segment ${canvasMode ? "active" : ""}`}
              disabled={!!exporting}
              title="3-8 s seamless loop at 1080×1920 — Spotify Canvas spec"
              onClick={() => store().setExportSettings({ mode: "canvas" })}
            >
              Canvas loop
            </button>
          </div>
        </div>

        <div className="field">
          <span>Format</span>
          <div className="segmented">
            <button
              className={`segment ${exportSettings.format === "mp4" ? "active" : ""}`}
              disabled={!!exporting}
              title="One video file with audio: H.264/HEVC/AV1 (.mp4) or VP9 with alpha (.webm)"
              onClick={() => store().setExportSettings({ format: "mp4" })}
            >
              MP4
            </button>
            <button
              className={`segment ${exportSettings.format === "png" ? "active" : ""}`}
              disabled={!!exporting || canvasMode}
              title={
                canvasMode
                  ? "Not available for Canvas loops (they upload as MP4)"
                  : "A folder of numbered PNG frames — keeps transparency (set Background to Transparent). No audio; for editors."
              }
              onClick={() => store().setExportSettings({ format: "png" })}
            >
              PNG frames
            </button>
            {isTauri() && (
              <button
                className={`segment ${exportSettings.format === "prores" ? "active" : ""}`}
                disabled={!!exporting || canvasMode}
                title={
                  canvasMode
                    ? "Not available for Canvas loops (they upload as MP4)"
                    : "One .mov file: ProRes 4444 with alpha + PCM audio — drops straight into Premiere/Resolve/After Effects"
                }
                onClick={() => store().setExportSettings({ format: "prores" })}
              >
                ProRes
              </button>
            )}
            {isTauri() && (
              <button
                className={`segment ${exportSettings.format === "gif" ? "active" : ""}`}
                disabled={!!exporting}
                title="Animated .gif loop — no audio; pairs with Canvas loop mode for a seamless loop"
                onClick={() => store().setExportSettings({ format: "gif" })}
              >
                GIF
              </button>
            )}
            {isTauri() && (
              <button
                className={`segment ${exportSettings.format === "webp" ? "active" : ""}`}
                disabled={!!exporting}
                title="Animated .webp loop — much smaller than GIF, keeps alpha; no audio"
                onClick={() => store().setExportSettings({ format: "webp" })}
              >
                WebP
              </button>
            )}
          </div>
        </div>

        {exportSettings.format === "png" && (
          <p className="section-hint">
            Writes numbered PNG frames into a folder you pick — no audio track. Set Background to{" "}
            <strong>Transparent</strong> to keep alpha for compositing.
          </p>
        )}

        {exportSettings.format === "prores" && (
          <p className="section-hint">
            ProRes 4444 (.mov) with alpha + untouched PCM audio — the editorial mezzanine. Set
            Background to <strong>Transparent</strong> to keep alpha. Encoded by the bundled ffmpeg
            (LGPL). Files are large by design.
          </p>
        )}

        {(exportSettings.format === "gif" || exportSettings.format === "webp") && (
          <p className="section-hint">
            Animated {exportSettings.format === "gif" ? "GIF" : "WebP"} — no audio. Best with{" "}
            <strong>Canvas loop</strong> mode (seamless loop) and a modest resolution; full-track
            animations get very large.
            {exportSettings.format === "webp" &&
              " WebP keeps alpha — set Background to Transparent for a transparent loop."}
          </p>
        )}

        {exportSettings.format === "mp4" && (
          <label className="field">
            <span>Loudness</span>
            <select
              className="select"
              value={exportSettings.loudnessTarget ?? ""}
              disabled={!!exporting}
              title="Match the exported audio to a loudness standard. Affects audio only — the visuals stay exactly as previewed."
              onChange={(e) =>
                store().setExportSettings({
                  loudnessTarget: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Off — keep original level</option>
              {LOUDNESS_PRESETS.map((p) => (
                <option key={p.lufs} value={p.lufs}>
                  {p.label} LUFS — {p.hint}
                </option>
              ))}
            </select>
          </label>
        )}

        {exportSettings.format === "mp4" && exportSettings.loudnessTarget != null && (
          <p className="section-hint">
            Measures the track and matches it to {exportSettings.loudnessTarget} LUFS, holding peaks
            under {exportSettings.truePeakDb} dBTP so nothing clips when a streaming service
            re-encodes it. Audio only — the visuals are unchanged. Already-loud tracks can land a
            little under target: the peak ceiling wins, and holding it costs loudness.
          </p>
        )}

        {!canvasMode && (
          <label className="field">
            <span>Resolution</span>
            <select
              className="select"
              value={exportSettings.resIdx}
              disabled={!!exporting}
              onChange={(e) => store().setExportSettings({ resIdx: Number(e.target.value) })}
            >
              {resolutionsForAspect(aspect).map((i) => (
                <option key={RESOLUTIONS[i].label} value={i}>
                  {RESOLUTIONS[i].label}
                </option>
              ))}
            </select>
          </label>
        )}

        {!canvasMode && exportSettings.format === "mp4" && codecChoices.length > 1 && (
          <label className="field">
            <span>Codec</span>
            <select
              className="select"
              value={exportSettings.codec}
              disabled={!!exporting}
              title="Encode format. Pixels are identical — this only changes file size and player compatibility. VP9 + alpha writes a transparent .webm (set Background to Transparent)."
              onChange={(e) => store().setExportSettings({ codec: e.target.value as VideoCodecId })}
            >
              {codecChoices.map((c) => (
                <option key={c} value={c}>
                  {CODEC_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        )}

        {!canvasMode && exportSettings.format === "mp4" && exportSettings.codec === "vp9a" && (
          <p className="section-hint">
            VP9 + alpha writes a transparent <strong>.webm</strong> — for OBS overlays, web embeds,
            and players that honor WebM transparency. Set Background to <strong>Transparent</strong>
            ; an opaque background just encodes a solid alpha.
          </p>
        )}

        {!canvasMode && (
          <label className="field">
            <span>Frame rate</span>
            <select
              className="select"
              value={exportSettings.fps}
              disabled={!!exporting}
              onChange={(e) => store().setExportSettings({ fps: Number(e.target.value) })}
            >
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
        )}

        {canvasMode && (
          <>
            <label className="field">
              <span>Loop length</span>
              <select
                className="select"
                value={exportSettings.canvasDuration}
                disabled={!!exporting}
                onChange={(e) =>
                  store().setExportSettings({ canvasDuration: Number(e.target.value) })
                }
              >
                {[3, 4, 5, 6, 7, 8].map((d) => (
                  <option key={d} value={d}>
                    {d} s
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              {/* Show the CLAMPED value — the label must match what the
                  slider shows and what the export actually uses. */}
              <span>
                Starts at {Math.min(exportSettings.canvasStart, canvasMaxStart).toFixed(1)} s
              </span>
              <Slider
                min={0}
                max={Math.max(0.1, canvasMaxStart)}
                step={0.1}
                value={Math.min(exportSettings.canvasStart, canvasMaxStart)}
                disabled={!!exporting}
                onChange={(v) => store().setExportSettings({ canvasStart: v })}
              />
            </div>
            <p className="section-hint">
              1080×1920 (9:16) at 30 fps. The last half second crossfades into the first — the loop
              point is seamless. Spotify Canvas accepts 3-8 s.
            </p>
          </>
        )}

        {exportSettings.format === "mp4" && (
          <div className="field">
            <span>Bitrate</span>
            <div className="bitrate-controls">
              <span className="inline">
                <Switch
                  checked={exportSettings.autoRate}
                  disabled={!!exporting}
                  onChange={(autoRate) => store().setExportSettings({ autoRate })}
                  label="Automatic bitrate"
                />
                Auto
              </span>
              {!exportSettings.autoRate && (
                <Slider
                  min={2}
                  max={60}
                  step={1}
                  value={exportSettings.manualMbps}
                  disabled={!!exporting}
                  onChange={(v) => store().setExportSettings({ manualMbps: v })}
                />
              )}
              <span className="row-value">{effectiveMbps} Mbps</span>
            </div>
          </div>
        )}

        <p className="section-hint">
          Renders the current preset, parameters and background — what you see live is what you get.
          Sync is sample-exact.
          {bg.mode === BG_TRANSPARENT &&
            exportSettings.format === "mp4" &&
            exportSettings.codec !== "vp9a" &&
            " Transparent background becomes black in MP4 — PNG frames, ProRes, WebP and VP9+alpha keep it."}
        </p>

        {exporting ? (
          <>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${exportPct}%` }} />
            </div>
            <div className="export-status">
              <span>
                {exportPct}% — frame {exporting.done}/{exporting.total}
                {exportSpeed ? ` · ${exportSpeed} fps` : ""}
              </span>
              <button className="text-btn danger" onClick={() => store().cancelExport()}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button className="btn-primary wide" onClick={() => void store().runExport()}>
            <IconExport size={16} />
            Export {res.w}×{res.h} @ {effFps} fps
          </button>
        )}
        {exportError && <div className="toast-inline error">{exportError}</div>}
        {exportDone && <div className="toast-inline success">{exportDone}</div>}
      </div>
    </div>
  );
}
