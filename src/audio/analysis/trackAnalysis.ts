import type { BeatGrid } from "./beatGrid";
import { analyzeBeatGrid } from "./beatGrid";
import type { PcmData } from "../types";
import { pcmFromAudioBuffer } from "../offlineSource";

/**
 * Main-thread facade for the analysis worker. One worker, jobs tagged with
 * a monotonically increasing id — a newly loaded track invalidates any
 * in-flight result (the stale id is simply ignored by the caller).
 */
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (grid: BeatGrid | null) => void>();

function ensureWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./analysisWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (
      e: MessageEvent<
        | { type: "beatGrid"; id: number; grid: BeatGrid }
        | { type: "error"; id: number; message: string }
      >,
    ) => {
      const msg = e.data;
      const resolve = pending.get(msg.id);
      if (!resolve) return;
      pending.delete(msg.id);
      if (msg.type === "beatGrid") resolve(msg.grid);
      else {
        console.error("[analysis]", msg.message);
        resolve(null);
      }
    };
    worker.onerror = () => {
      // Worker failed to boot — resolve everything null; callers fall back
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
    };
  }
  return worker;
}

/** Analyze a decoded track. Resolves null on failure (callers degrade). */
export function analyzeTrack(audio: AudioBuffer): { id: number; result: Promise<BeatGrid | null> } {
  const id = nextId++;
  const pcm = pcmFromAudioBuffer(audio);
  // Copies — the worker transfer must not detach the engine's live buffer
  const copy: PcmData = { ...pcm, channels: pcm.channels.slice(0, 2).map((c) => c.slice()) };
  const w = ensureWorker();
  if (!w) {
    // No workers (rare) — run inline rather than not at all
    return {
      id,
      result: Promise.resolve().then(() => {
        try {
          return analyzeBeatGrid(copy);
        } catch {
          return null;
        }
      }),
    };
  }
  const result = new Promise<BeatGrid | null>((resolve) => {
    pending.set(id, resolve);
    w.postMessage(
      { type: "analyze", id, pcm: copy },
      copy.channels.map((c) => c.buffer),
    );
  });
  return { id, result };
}
