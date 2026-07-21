import { describe, expect, it } from "vitest";
import { wavFromPcm } from "./wav";
import type { PcmData } from "../types";

function pcm(channels: Float32Array[], sampleRate = 48000): PcmData {
  return {
    sampleRate,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    channels,
  };
}

describe("wavFromPcm", () => {
  it("writes a valid stereo 16-bit header", () => {
    const w = wavFromPcm(pcm([new Float32Array(10), new Float32Array(10)]));
    const v = new DataView(w.buffer);
    expect(String.fromCharCode(w[0], w[1], w[2], w[3])).toBe("RIFF");
    expect(String.fromCharCode(w[8], w[9], w[10], w[11])).toBe("WAVE");
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(2); // stereo
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(34, true)).toBe(16); // bit depth
    expect(v.getUint32(40, true)).toBe(10 * 4); // data bytes
    expect(w.length).toBe(44 + 40);
  });

  it("interleaves and quantizes samples, clamping overs", () => {
    const l = new Float32Array([0, 1, -1, 2]);
    const r = new Float32Array([0.5, -0.5, 0.25, -2]);
    const w = wavFromPcm(pcm([l, r]));
    const v = new DataView(w.buffer);
    const s = (i: number) => v.getInt16(44 + i * 2, true);
    expect(s(0)).toBe(0);
    expect(s(1)).toBe(16384); // 0.5 -> round(16383.5)
    expect(s(2)).toBe(32767); // full scale
    expect(s(3)).toBe(-16383); // Math.round(-16383.5) rounds toward +inf
    expect(s(4)).toBe(-32767);
    expect(s(6)).toBe(32767); // +2 clamps
    expect(s(7)).toBe(-32767); // -2 clamps
  });

  it("mono stays mono", () => {
    const w = wavFromPcm(pcm([new Float32Array([0.5])]));
    const v = new DataView(w.buffer);
    expect(v.getUint16(22, true)).toBe(1);
    expect(w.length).toBe(44 + 2);
  });

  it("throws instead of writing a silently corrupt header past the u32 RIFF size limit", () => {
    // RIFF/data chunk sizes are u32; DataView.setUint32 wraps out-of-range
    // values modulo 2^32 rather than throwing, so past ~6.7 h of 44.1 kHz
    // stereo the old code wrote a header whose declared length undershot the
    // real file by however much it wrapped — a silently corrupt WAV. The
    // channel arrays are deliberately EMPTY: the guard must fire from
    // length/sampleRate metadata alone, before indexing sample data or
    // allocating the multi-gigabyte output buffer.
    const huge: PcmData = {
      sampleRate: 44100,
      length: 2 ** 32,
      duration: 2 ** 32 / 44100,
      channels: [new Float32Array(0), new Float32Array(0)],
    };
    expect(() => wavFromPcm(huge)).toThrow();
    expect(() => wavFromPcm(huge)).toThrow(/too long|overflow|u32/i);
  });

  it("stays under the u32 limit for an ordinary recording", () => {
    // 1 minute of real stereo audio is nowhere near the ~6.7 h boundary and
    // must encode normally, not trip the new guard.
    const frames = 44100 * 60;
    const l = new Float32Array(frames);
    const r = new Float32Array(frames);
    expect(() => wavFromPcm(pcm([l, r]))).not.toThrow();
  });
});
