/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { analyzeBeatGrid } from "./beatGrid";
import type { PcmData } from "../types";

/**
 * Track-analysis worker: runs the offline analysis pass (beat grid now;
 * onset classes / key / sections join it in later phases) without touching
 * the main thread. One job per message; results post back tagged.
 */
type InMessage = { type: "analyze"; id: number; pcm: PcmData };

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type !== "analyze") return;
  try {
    const grid = analyzeBeatGrid(msg.pcm);
    self.postMessage({ type: "beatGrid", id: msg.id, grid }, [grid.beatTimes.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: (err as Error).message });
  }
};
