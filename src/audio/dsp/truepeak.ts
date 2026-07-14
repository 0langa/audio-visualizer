/**
 * True-peak measurement and limiting (ITU-R BS.1770-4 Annex 2 in spirit).
 *
 * A sample peak under 0 dBFS says nothing about what a DAC reconstructs
 * *between* samples — inter-sample peaks routinely overshoot by 1-3 dB, and
 * that overshoot is what clips lossy decoders downstream. So peaks are measured
 * on a 4x-oversampled reconstruction ("dBTP") rather than on the samples.
 *
 * The spec fixes a particular coefficient table for that reconstruction. Rather
 * than reproduce ITU's table, this designs an equivalent polyphase
 * Kaiser-windowed-sinc interpolator at the same 4x ratio. Two properties were
 * settled by measuring worst-case under-read across crest positions, since a
 * meter that reads low is worse than no meter at all:
 *
 * - **Odd length** (OVERSAMPLE*TAPS+1), so the group delay is a whole number of
 *   base samples. That makes branch 0 a pure delay which reproduces the input
 *   samples exactly. With an even-length filter every branch sits at a
 *   fractional offset, the original sample grid is never evaluated, and a peak
 *   landing squarely on a sample gets missed.
 * - **24 taps per branch**, where worst-case error bottoms out at -0.168 dB.
 *   12 taps gives -0.470 dB; 32 taps gives no improvement at all.
 *
 * That remaining -0.168 dB is the 4x grid itself, not the filter: a crest can
 * hide between oversampled points regardless of how good the interpolator is.
 * It is exactly why the recommended ceiling is -1 dBTP and not -0.1.
 */

/** Oversampling ratio used for inter-sample peak reconstruction. */
export const OVERSAMPLE = 4;
/** Base-rate samples of history feeding each polyphase branch. */
const TAPS = 24;
/** Kaiser shape; trades stopband rejection against transition width. */
const KAISER_BETA = 8;
/** Prototype length. Odd, so the group delay lands on a whole base sample. */
const PROTO = OVERSAMPLE * TAPS + 1;
/** Prototype centre; a multiple of OVERSAMPLE, hence branch 0 = pure delay. */
const CENTER = (OVERSAMPLE * TAPS) / 2;
/** Branch 0 needs one extra tap once the prototype length is odd. */
const HIST = TAPS + 1;
/** Group delay of the interpolator, exactly this many base samples. */
const DETECT_LATENCY = CENTER / OVERSAMPLE;

function sinc(x: number): number {
  if (x === 0) return 1;
  const p = Math.PI * x;
  return Math.sin(p) / p;
}

/** Zeroth-order modified Bessel function of the first kind, for the window. */
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 50; k++) {
    term *= (x / (2 * k)) ** 2;
    sum += term;
    if (term < sum * 1e-16) break;
  }
  return sum;
}

/**
 * Polyphase branches of a Kaiser-windowed sinc, cut off at the base-rate
 * Nyquist. Each branch is normalised to unit DC gain so a constant signal
 * reconstructs to itself — otherwise every branch would report a phantom
 * inter-sample peak on DC.
 */
function buildPhases(): Float64Array[] {
  const h = new Float64Array(PROTO);
  const denom = besselI0(KAISER_BETA);
  for (let k = 0; k < PROTO; k++) {
    const r = (2 * k) / (PROTO - 1) - 1;
    const w = besselI0(KAISER_BETA * Math.sqrt(Math.max(0, 1 - r * r))) / denom;
    h[k] = sinc((k - CENTER) / OVERSAMPLE) * w;
  }
  const phases: Float64Array[] = [];
  for (let p = 0; p < OVERSAMPLE; p++) {
    const branch = new Float64Array(HIST);
    let sum = 0;
    for (let m = 0; m < HIST; m++) {
      // Branches past branch 0 run one tap short of the prototype.
      const k = p + OVERSAMPLE * m;
      branch[m] = k < PROTO ? h[k] : 0;
      sum += branch[m];
    }
    for (let m = 0; m < HIST; m++) branch[m] /= sum;
    phases.push(branch);
  }
  return phases;
}

const PHASES = buildPhases();

/**
 * Per-channel 4x reconstruction, streaming. Feed base-rate samples; each push
 * returns the largest absolute value of the reconstructed waveform around the
 * sample DETECT_LATENCY pushes ago.
 */
class PeakInterpolator {
  private hist = new Float64Array(HIST);
  private pos = 0;

  push(x: number): number {
    this.hist[this.pos] = x;
    let peak = 0;
    for (let p = 0; p < OVERSAMPLE; p++) {
      const branch = PHASES[p];
      let acc = 0;
      for (let m = 0; m < HIST; m++) {
        // hist[pos] is the newest sample, so tap m reads m samples back.
        acc += branch[m] * this.hist[(this.pos - m + HIST) % HIST];
      }
      const a = Math.abs(acc);
      if (a > peak) peak = a;
    }
    this.pos = (this.pos + 1) % HIST;
    return peak;
  }
}

/** Linear amplitude -> dB, floored so silence returns a finite number. */
export function toDb(linear: number): number {
  return 20 * Math.log10(Math.max(1e-12, linear));
}

/**
 * True-peak level (dBTP) of a whole buffer. Streams — allocates only the
 * per-channel interpolator state regardless of track length.
 */
export function truePeakDbfs(channels: Float32Array[], _sampleRate?: number): number {
  const length = channels[0]?.length ?? 0;
  if (length === 0) return toDb(0);
  const interps = channels.map(() => new PeakInterpolator());
  let peak = 0;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels.length; ch++) {
      const v = interps[ch].push(channels[ch][i] ?? 0);
      if (v > peak) peak = v;
    }
  }
  // Flush the interpolator's tail so the final samples are actually measured.
  for (let i = 0; i < DETECT_LATENCY; i++) {
    for (const interp of interps) {
      const v = interp.push(0);
      if (v > peak) peak = v;
    }
  }
  return toDb(peak);
}

export interface LimiterReport {
  /** Highest true peak seen after makeup gain, before limiting (dBTP). */
  peakInDb: number;
  /** Deepest gain reduction the limiter applied (dB, <= 0). */
  reductionDb: number;
}

/**
 * Look-ahead true-peak limiter, streaming and deterministic.
 *
 * Chain per sample: makeup gain -> 4x true-peak detect -> per-sample gain the
 * peak demands -> exponential release -> sliding minimum over the look-ahead
 * window -> boxcar average over the same window.
 *
 * The last two stages are what make it both smooth and exact. The sliding
 * minimum holds the required gain for a full window around each peak, so the
 * boxcar's window at the peak instant contains nothing but that value and
 * averages to it precisely — the ceiling is hit exactly, with no discontinuity
 * in the gain curve to buzz. Reducing gain gradually ahead of a peak is why the
 * signal is delayed by `latency` samples: the limiter must see the peak before
 * the audio it applies to reaches the output.
 */
export class TruePeakLimiter {
  /** Samples of delay the limiter imposes; callers must compensate. */
  readonly latency: number;

  private interps: PeakInterpolator[];
  private delay: Float32Array[];
  private dpos = 0;

  private readonly win: number;
  private readonly ceilLin: number;
  private readonly releaseCoef: number;
  private release = 1;

  // Monotonic deque for the sliding minimum (capacity win+1: an insert can
  // briefly hold win+1 entries before the front is evicted).
  private dqV: Float64Array;
  private dqI: Int32Array;
  private dqHead = 0;
  private dqCount = 0;

  private box: Float64Array;
  private boxPos = 0;
  private boxSum: number;

  private t = 0;
  private peakIn = 0;
  private minGain = 1;

  constructor(
    sampleRate: number,
    private readonly channels: number,
    private readonly gain: number,
    ceilingDb: number,
    lookaheadMs = 2,
    releaseMs = 50,
  ) {
    this.win = Math.max(1, Math.round((sampleRate * lookaheadMs) / 1000));
    this.ceilLin = Math.pow(10, ceilingDb / 20);
    this.releaseCoef = 1 - Math.exp(-1 / Math.max(1, (sampleRate * releaseMs) / 1000));
    this.latency = DETECT_LATENCY + this.win - 1;

    this.interps = Array.from({ length: channels }, () => new PeakInterpolator());
    this.delay = Array.from({ length: channels }, () => new Float32Array(this.latency));
    this.dqV = new Float64Array(this.win + 1);
    this.dqI = new Int32Array(this.win + 1);
    // Unity until real gain values arrive, so the ramp-in never boosts.
    this.box = new Float64Array(this.win).fill(1);
    this.boxSum = this.win;
  }

  /**
   * Limit `frames` frames of planar audio in place (channel `ch` occupying
   * [ch * frames, ch * frames + frames)).
   *
   * Output lags input by `latency` samples: the value written for frame i is
   * the input from frame i - latency. Feed `latency` samples before the range
   * you want emitted, and zero-pad `latency` samples past the end.
   */
  process(planar: Float32Array, frames: number, channels = this.channels): void {
    const cap = this.win + 1;
    for (let i = 0; i < frames; i++) {
      // Makeup gain first, so detection sees the level we'll actually emit.
      let det = 0;
      for (let ch = 0; ch < channels; ch++) {
        const idx = ch * frames + i;
        const x = planar[idx] * this.gain;
        const v = this.interps[ch].push(x);
        if (v > det) det = v;
        // Park the gained sample; it leaves via the delay line below.
        const d = this.delay[ch];
        planar[idx] = d[this.dpos];
        d[this.dpos] = x;
      }
      this.dpos = (this.dpos + 1) % this.latency;
      if (det > this.peakIn) this.peakIn = det;

      const desired = det > this.ceilLin ? this.ceilLin / det : 1;
      // Instant drop, exponential recovery: without the hold, gain would snap
      // back between peaks and intermodulate the bass.
      this.release =
        desired < this.release ? desired : this.release + (1 - this.release) * this.releaseCoef;

      const v = this.release;
      while (this.dqCount > 0 && this.dqV[(this.dqHead + this.dqCount - 1) % cap] >= v) {
        this.dqCount--;
      }
      this.dqV[(this.dqHead + this.dqCount) % cap] = v;
      this.dqI[(this.dqHead + this.dqCount) % cap] = this.t;
      this.dqCount++;
      while (this.dqCount > 0 && this.dqI[this.dqHead] <= this.t - this.win) {
        this.dqHead = (this.dqHead + 1) % cap;
        this.dqCount--;
      }
      const mn = this.dqV[this.dqHead];

      this.boxSum -= this.box[this.boxPos];
      this.box[this.boxPos] = mn;
      this.boxSum += mn;
      this.boxPos = (this.boxPos + 1) % this.win;
      const g = this.boxSum / this.win;
      if (g < this.minGain) this.minGain = g;

      for (let ch = 0; ch < channels; ch++) planar[ch * frames + i] *= g;
      this.t++;
    }
  }

  get report(): LimiterReport {
    return { peakInDb: toDb(this.peakIn), reductionDb: toDb(this.minGain) };
  }
}
