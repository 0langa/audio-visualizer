/**
 * Synthesized demo tracks via OfflineAudioContext — three characters so
 * visualizer behavior can be judged across styles with zero local files:
 *  - Groove: mid-tempo house-ish loop (steady four-on-floor)
 *  - Neuro: fast DnB (busy transients, heavy sub, hectic)
 *  - Drift: slow ambient (pads, sparse hits, quiet dynamics)
 */
export interface DemoDef {
  id: string;
  name: string;
  render(sampleRate: number): Promise<AudioBuffer>;
}

interface Kit {
  ctx: OfflineAudioContext;
  master: GainNode;
  noiseBuf: AudioBuffer;
}

function makeKit(sampleRate: number, duration: number): Kit {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  const noiseBuf = ctx.createBuffer(1, sampleRate, sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return { ctx, master, noiseBuf };
}

function kick(k: Kit, t: number, punch = 1) {
  const osc = k.ctx.createOscillator();
  const g = k.ctx.createGain();
  osc.frequency.setValueAtTime(150 * punch, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(1.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g).connect(k.master);
  osc.start(t);
  osc.stop(t + 0.3);
}

function hat(k: Kit, t: number, open: boolean, level = 0.25) {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noiseBuf;
  const hp = k.ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = k.ctx.createGain();
  const len = open ? 0.18 : 0.05;
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(hp).connect(g).connect(k.master);
  src.start(t);
  src.stop(t + len + 0.01);
}

function snare(k: Kit, t: number, level = 0.5) {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noiseBuf;
  const bp = k.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.connect(bp).connect(g).connect(k.master);
  src.start(t);
  src.stop(t + 0.16);
  // tonal body
  const osc = k.ctx.createOscillator();
  osc.frequency.setValueAtTime(190, t);
  const og = k.ctx.createGain();
  og.gain.setValueAtTime(level * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(og).connect(k.master);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Mid-tempo groove: 120 BPM, four-on-floor, saw bass, square arps. */
async function renderGroove(sampleRate: number): Promise<AudioBuffer> {
  const bpm = 120;
  const beat = 60 / bpm;
  const bars = 8;
  const k = makeKit(sampleRate, bars * 4 * beat);
  const { ctx, master } = k;

  const bassNote = (t: number, freq: number, len: number) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.setValueAtTime(0.32, t + len - 0.03);
    g.gain.linearRampToValueAtTime(0, t + len);
    osc.connect(lp).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + len);
  };

  const arpNote = (t: number, freq: number) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.sin(t * 2.1) * 0.6;
    osc.connect(g).connect(pan).connect(master);
    osc.start(t);
    osc.stop(t + 0.2);
  };

  const roots = [55.0, 43.65, 65.41, 49.0]; // A1 F1 C2 G1
  const arpSets = [
    [220.0, 261.63, 329.63, 440.0],
    [174.61, 220.0, 261.63, 349.23],
    [261.63, 329.63, 392.0, 523.25],
    [196.0, 246.94, 293.66, 392.0],
  ];

  for (let bar = 0; bar < bars; bar++) {
    const barT = bar * 4 * beat;
    const chord = bar % 4;
    for (let b = 0; b < 4; b++) {
      const t = barT + b * beat;
      kick(k, t);
      hat(k, t + beat / 2, b === 3);
      if (b === 1 || b === 3) hat(k, t, false);
      bassNote(t, roots[chord] * (b === 2 ? 1.5 : 1), beat * 0.9);
    }
    if (bar >= 2) {
      for (let s = 0; s < 8; s++) {
        arpNote(barT + s * (beat / 2), arpSets[chord][s % 4] * (s >= 4 ? 2 : 1));
      }
    }
  }
  return ctx.startRendering();
}

/** Fast DnB: 174 BPM, broken kicks, backbeat snares, reese bass, stab hits. */
async function renderNeuro(sampleRate: number): Promise<AudioBuffer> {
  const bpm = 174;
  const beat = 60 / bpm;
  const bars = 16;
  const k = makeKit(sampleRate, bars * 4 * beat);
  const { ctx, master } = k;

  const reese = (t: number, freq: number, len: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.02);
    g.gain.setValueAtTime(0.2, t + len - 0.05);
    g.gain.linearRampToValueAtTime(0.001, t + len);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + len);
    lp.Q.value = 2;
    for (const detune of [-12, 0, 12]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + len);
    }
    lp.connect(g).connect(master);
    // sub reinforcement
    const sub = ctx.createOscillator();
    sub.frequency.value = freq / 2;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.25, t);
    sg.gain.linearRampToValueAtTime(0.001, t + len);
    sub.connect(sg).connect(master);
    sub.start(t);
    sub.stop(t + len);
  };

  const stab = (t: number, freq: number) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 3;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.sin(t * 5.7) * 0.7;
    osc.connect(bp).connect(g).connect(pan).connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
  };

  const roots = [41.2, 41.2, 49.0, 36.71]; // E1 E1 G1 D1
  for (let bar = 0; bar < bars; bar++) {
    const barT = bar * 4 * beat;
    const root = roots[bar % 4];
    // Amen-ish: kicks on 1 and 2.5, snares on 2 and 4
    kick(k, barT, 1.1);
    kick(k, barT + 1.5 * beat, 1.05);
    snare(k, barT + 1 * beat, 0.55);
    snare(k, barT + 3 * beat, 0.6);
    if (bar % 2 === 1) snare(k, barT + 3.75 * beat, 0.3); // ghost
    // rolling 16th hats
    for (let s = 0; s < 16; s++) {
      hat(k, barT + s * (beat / 4), false, s % 4 === 2 ? 0.22 : 0.12);
    }
    // bass movement per half bar
    reese(barT, root, beat * 1.9);
    reese(barT + 2 * beat, root * (bar % 4 === 2 ? 1.335 : 1.0), beat * 1.9);
    // stabs after intro
    if (bar >= 4) {
      stab(barT + 0.75 * beat, root * 8);
      stab(barT + 2.25 * beat, root * 6);
      if (bar % 2 === 0) stab(barT + 3.5 * beat, root * 9);
    }
  }
  return ctx.startRendering();
}

/** Slow ambient: 70 BPM, detuned pads, sub swells, sparse rims and bells. */
async function renderDrift(sampleRate: number): Promise<AudioBuffer> {
  const bpm = 70;
  const beat = 60 / bpm;
  const bars = 8;
  const k = makeKit(sampleRate, bars * 4 * beat);
  const { ctx, master } = k;

  const pad = (t: number, freqs: number[], len: number) => {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1600, t + len * 0.5);
    lp.frequency.linearRampToValueAtTime(500, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.09, t + len * 0.3);
    g.gain.setValueAtTime(0.09, t + len * 0.7);
    g.gain.linearRampToValueAtTime(0.001, t + len);
    lp.connect(g).connect(master);
    for (const f of freqs) {
      for (const det of [-6, 5]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = f;
        osc.detune.value = det;
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + len);
      }
    }
  };

  const sub = (t: number, freq: number, len: number) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.3, t + len * 0.2);
    g.gain.setValueAtTime(0.3, t + len * 0.6);
    g.gain.linearRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + len);
  };

  const bell = (t: number, freq: number) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.sin(t * 1.3) * 0.8;
    osc.connect(g).connect(pan).connect(master);
    osc.start(t);
    osc.stop(t + 1.5);
    // faint octave shimmer
    const o2 = ctx.createOscillator();
    o2.frequency.value = freq * 2.01;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.025, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o2.connect(g2).connect(pan);
    o2.start(t);
    o2.stop(t + 1.0);
  };

  const rim = (t: number) => hat(k, t, false, 0.08);

  // Dm9-ish then Bbmaj7-ish alternating, one chord per 2 bars
  const chords = [
    [146.83, 174.61, 220.0, 261.63], // D F A C
    [116.54, 146.83, 174.61, 220.0], // Bb D F A
  ];
  const bellNotes = [587.33, 523.25, 440.0, 698.46];

  for (let bar = 0; bar < bars; bar++) {
    const barT = bar * 4 * beat;
    if (bar % 2 === 0) {
      const c = chords[(bar / 2) % 2];
      pad(barT, c, 8 * beat);
      sub(barT, c[0] / 2, 8 * beat);
    }
    // sparse percussion: rim on offbeats of 2 and 4, not every bar
    if (bar % 2 === 1) {
      rim(barT + 1.5 * beat);
      rim(barT + 3.5 * beat);
    }
    // occasional bell
    if (bar >= 1 && bar % 2 === 1) {
      bell(barT + (bar % 4 === 1 ? 0.5 : 2.0) * beat, bellNotes[bar % 4]);
    }
  }
  return ctx.startRendering();
}

export const demos: DemoDef[] = [
  { id: "groove", name: "Groove (120 BPM house)", render: renderGroove },
  { id: "neuro", name: "Neuro (174 BPM DnB)", render: renderNeuro },
  { id: "drift", name: "Drift (70 BPM ambient)", render: renderDrift },
];
