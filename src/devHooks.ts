import { useVizStore } from "./state/store";
import { getEngine } from "./state/services";
import { rasterizeOverlay } from "./render/overlay";
import { exportVideo } from "./export/videoExporter";
import type { VideoCodecId } from "./export/codecProbe";
import { DEFAULT_POST } from "./render/types";
import { audiogramActive } from "./state/audiogram";
import { integratedLufs } from "./audio/dsp/lufs";
import { truePeakDbfs } from "./audio/dsp/truepeak";
import { expandJobs, type BatchRun } from "./state/batch";
import { runBatch } from "./state/batchRunner";
import { DEFAULT_LYRIC_STYLE } from "./state/lyrics";
import { DEFAULT_AUDIOGRAM } from "./state/audiogram";

/**
 * Dev-only E2E probes, extracted whole from App.tsx (they were ~240 lines and
 * half its import list). Installed once by a DEV-gated effect; every probe
 * hangs off `window` so the browser-pane harness can drive the real export
 * and batch pipelines without a filesystem.
 */

/**
 * FNV-1a over raw PNG bytes — a content fingerprint for the export harness.
 * Not cryptographic; it only has to make "these two frames differ" cheap to
 * see across thousands of frames.
 */
function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function installDevHooks(store: typeof useVizStore.getState): void {
  // The app's store instance (HMR-safe), for state assertions in E2E runs
  (window as unknown as { __store: unknown }).__store = useVizStore;
  // The live audio engine, for E2E probes (module import from the console
  // would get a DIFFERENT instance — "services not initialized").
  (window as unknown as { __engine: unknown }).__engine = getEngine();
  (window as unknown as { __loadFile: unknown }).__loadFile = async (url: string, name: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
    const buf = await r.arrayBuffer();
    await store().loadFile(new File([buf], name));
    return getEngine().state;
  };
  (window as unknown as { __runExport: unknown }).__runExport = async (
    opts: Partial<{
      width: number;
      height: number;
      fps: number;
      withOverlay: boolean;
      canvasLoop: { start: number; duration: number };
      post: import("./render/types").PostSettings;
      /** Video codec — mirrors store.runExport's ExportSettings.codec. */
      codec: VideoCodecId;
      /** Render a PNG sequence instead of MP4; frames are counted, not written. */
      png: boolean;
      /** Normalize the exported audio (audio lane only). */
      loudness: import("./export/exportCore").LoudnessJob;
      /**
       * Decode the finished MP4 and re-measure it, so normalization is
       * verified end-to-end through the encoder rather than trusting the
       * limiter's own arithmetic.
       */
      verifyAudio: boolean;
    }> = {},
  ) => {
    const buf = getEngine().audioBuffer;
    if (!buf) throw new Error("no track loaded");
    const s = store();
    const w = opts.width ?? 320;
    const h = opts.height ?? 180;
    // Overlay: the document's real layers (mirrors store.runExport), or a
    // synthetic test box when withOverlay is forced.
    let overlay: ImageBitmap | undefined;
    if (opts.withOverlay) {
      const oc = new OffscreenCanvas(w, h);
      const c2d = oc.getContext("2d")!;
      c2d.fillStyle = "rgba(255,40,40,0.9)";
      c2d.fillRect(w * 0.25, h * 0.4, w * 0.5, h * 0.2);
      overlay = oc.transferToImageBitmap();
    } else {
      overlay = (await rasterizeOverlay(s.overlayLayers, s.assets, w, h, s.trackMeta)) ?? undefined;
    }
    const t0 = performance.now();
    // PNG probe: collect frame sizes instead of writing files (no desktop fs
    // in a browser); lets the harness verify the sequence path end-to-end.
    const pngFrames: number[] = [];
    // A per-frame content hash, not just frame 0. Anything that ACCUMULATES
    // across frames (the particle sim, feedback trails) is identical on frame
    // 0 no matter how badly it diverges later, so a frame-0-only baseline
    // silently passes the exact regressions it exists to catch.
    const pngHashes: string[] = [];
    const result = await exportVideo(buf, {
      onPngFrame: opts.png
        ? (data, index) => {
            pngFrames.push(data.length);
            pngHashes.push(fnv1a(data));
            // Keep frame 0 around so tooling can decode + inspect it.
            if (index === 0) {
              (window as unknown as { __lastPngFrame: Blob }).__lastPngFrame = new Blob(
                [data.slice()],
                { type: "image/png" },
              );
            }
            // ...and the FINAL frame, which is the only useful one for
            // anything that accumulates. Frame 0 of the particle sim is the
            // initial seeded disc (uniform noise) and frame 0 of a feedback
            // preset has no trail at all, so a frame-0-only probe makes
            // those two look broken when they are working perfectly.
            (window as unknown as { __lastPngFrameEnd: Blob }).__lastPngFrameEnd = new Blob(
              [data.slice()],
              { type: "image/png" },
            );
          }
        : undefined,
      width: w,
      height: h,
      fps: opts.fps ?? 30,
      bitrate: 1_000_000,
      codec: opts.codec,
      presetId: s.presetId,
      params: s.activeParams,
      // Per-mode overrides (v2.46) — mirror buildExportOptions or the probe
      // silently tests the wrong background/cover.
      bg: s.bgByPreset[s.presetId] ?? s.bg,
      sync: s.sync,
      overlay,
      segment: opts.canvasLoop,
      loopCrossfadeSec: opts.canvasLoop ? 0.5 : undefined,
      beatGrid: s.beatGrid ?? undefined,
      stems: s.stems,
      lyrics:
        s.lyrics && s.lyricStyle.enabled ? { lines: s.lyrics, style: s.lyricStyle } : undefined,
      audiogram: audiogramActive(s.audiogram)
        ? { settings: s.audiogram, waveform: s.waveformOverview }
        : undefined,
      customPresets: s.customDefs,
      builderStack: s.builderStack,
      mods: s.activeMods,
      smoothSpectrum: s.smoothSpectrum,
      // Merge onto DEFAULT_POST. A partial post object is a trap: `exposure`
      // is a MULTIPLY (1 = neutral), so omitting it lands 0 in the uniform
      // and every frame renders solid black — which silently turned a whole
      // regression baseline into hashes of black frames.
      post: opts.post ? { ...DEFAULT_POST, ...opts.post } : s.post,
      motion: s.motion,
      coverArt:
        (s.centerImageByPreset[s.presetId]
          ? s.assets[s.centerImageByPreset[s.presetId]]?.dataUrl
          : undefined) ??
        s.coverArt ??
        undefined,
      bgImage: (() => {
        const bg = s.bgByPreset[s.presetId] ?? s.bg;
        return bg.mode === 3 && bg.image && s.assets[bg.image.assetId]
          ? {
              dataUrl: s.assets[bg.image.assetId].dataUrl,
              dim: bg.image.dim,
              blur: bg.image.blur,
            }
          : undefined;
      })(),
      bgVideo: (() => {
        const bg = s.bgByPreset[s.presetId] ?? s.bg;
        return bg.mode === 4 && bg.video && s.assets[bg.video.assetId]
          ? { dataUrl: s.assets[bg.video.assetId].dataUrl, dim: bg.video.dim }
          : undefined;
      })(),
      timeline: s.timeline.enabled ? s.timeline : undefined,
      paramsByPreset: s.paramsByPreset,
      modsByPreset: s.modsByPreset,
      loudness: opts.loudness,
    });
    // Decode what we actually wrote and measure it. AAC is lossy, so this is
    // the honest number a delivery target would see — not what we intended.
    let measured: { lufs: number; truePeakDb: number } | undefined;
    if (opts.verifyAudio && result.blob) {
      const ac = new AudioContext();
      try {
        const decoded = await ac.decodeAudioData(await result.blob.arrayBuffer());
        const chans = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
          decoded.getChannelData(i),
        );
        measured = {
          lufs: integratedLufs(chans, decoded.sampleRate),
          truePeakDb: truePeakDbfs(chans),
        };
      } finally {
        await ac.close();
      }
    }
    const info = {
      bytes: result.bytes,
      ms: Math.round(performance.now() - t0),
      audioCodec: result.audioCodec,
      seconds: result.seconds,
      ...(result.loudness ? { loudness: result.loudness } : {}),
      ...(measured ? { measured } : {}),
      ...(opts.png ? { pngFrames: pngFrames.length, pngBytes: pngFrames, pngHashes } : {}),
    };
    (window as unknown as { __lastExport: unknown }).__lastExport = info;
    (window as unknown as { __lastExportBlob: Blob | undefined }).__lastExportBlob = result.blob;
    return info;
  };

  // Drives the REAL batch runner without a filesystem: jobs render to blobs
  // instead of streaming to disk, so the loop (per-track decode + analysis,
  // per-job isolation, abort, ordering) can be exercised in browser dev.
  (window as unknown as { __runBatch: unknown }).__runBatch = async (
    files: File[],
    opts: { width?: number; height?: number; fps?: number; failOn?: number } = {},
  ) => {
    // Start clean: addBatchTracks appends (as it should for the real UI),
    // which would silently carry tracks over between probe runs.
    for (const t of store().batch?.tracks ?? []) store().removeBatchTrack(t.id);
    await store().addBatchTracks(files);
    // Re-read AFTER the await: store() is a snapshot and zustand replaces the
    // state object on set, so the pre-await one never sees the new tracks.
    const s = store();
    const tracks = s.batch?.tracks ?? [];
    const fmt = {
      id: "probe",
      label: "probe",
      w: opts.width ?? 192,
      h: opts.height ?? 108,
      fps: opts.fps ?? 30,
      mbps: 1,
      format: "mp4" as const,
    };
    const run = {
      doc: {
        presetId: s.presetId,
        paramsByPreset: s.paramsByPreset,
        syncByPreset: s.syncByPreset,
        bg: s.bg,
        bgByPreset: s.bgByPreset,
        centerImageByPreset: s.centerImageByPreset,
        overlayLayers: s.overlayLayers,
        assets: s.assets,
        aspect: s.aspect,
        modsByPreset: s.modsByPreset,
        smoothSpectrum: s.smoothSpectrum,
        timeline: s.timeline,
        post: s.post,
        motion: s.motion,
        // v9 document fields — the probe's frozen doc mirrors docOf. (This
        // literal predates them; the `as BatchRun` cast hid the omission.)
        lyricStyle: { ...DEFAULT_LYRIC_STYLE },
        audiogram: { ...DEFAULT_AUDIOGRAM },
        customDefs: [],
      },
      tracks,
      formats: [fmt],
      outDir: "/probe",
      startedAt: performance.now(),
      jobs: [],
    } as unknown as BatchRun;
    run.jobs = expandJobs(run.tracks, run.formats, run.outDir);

    const events: string[] = [];
    const statuses: Record<string, unknown> = {};
    let n = 0;
    await runBatch(run, {
      streamPathFor: () => undefined, // blob mode: no fs needed
      onJobStart: (id) => {
        events.push(`start:${id}`);
        // Simulate a mid-run failure to prove isolation, if asked.
        if (opts.failOn != null && n === opts.failOn) throw new Error("probe: injected");
        n++;
      },
      onJobUpdate: (id, st) => {
        statuses[id] = st;
        if (st.k !== "running") events.push(`${st.k}:${id}`);
      },
      shouldStop: () => false,
    });
    return {
      jobs: run.jobs.map((j) => ({
        out: j.outPath,
        status: statuses[j.id] ?? j.status,
      })),
      events,
    };
  };
}
