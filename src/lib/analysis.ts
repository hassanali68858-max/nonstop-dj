// Audio analysis: tempo + beat grid, bars, audible range, and where the vocals start.
// Everything runs in the browser on a decoded AudioBuffer.

export const PR = 200; // waveform peaks per second

export interface Analysis {
  bpm: number;
  p: number; // beat period (s)
  ph: number; // time of beat 0 (s)
  down: number; // which beat (0..3) starts a bar
  first: number; // first audible moment (s)
  last: number; // last audible moment (s)
  vox: number | null; // first sustained vocals (s)
  dur: number;
}

export interface Peaks {
  peaks: Float32Array;
  gmax: number;
  first: number;
  last: number;
}

const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));

export function computePeaks(buf: AudioBuffer): Peaks {
  const dur = buf.duration;
  const chs: Float32Array[] = [];
  for (let i = 0; i < buf.numberOfChannels; i++) chs.push(buf.getChannelData(i));
  const n = Math.ceil(dur * PR);
  const step = buf.sampleRate / PR;
  const peaks = new Float32Array(n);
  let gmax = 1e-6;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * step);
    const b = Math.min(buf.length, Math.floor((i + 1) * step));
    for (const c of chs)
      for (let j = a; j < b; j += 2) {
        const v = c[j] < 0 ? -c[j] : c[j];
        if (v > m) m = v;
      }
    peaks[i] = m;
    if (m > gmax) gmax = m;
  }
  let fi = 0;
  while (fi < n && peaks[fi] < gmax * 0.06) fi++;
  let li = n - 1;
  while (li > 0 && peaks[li] < gmax * 0.1) li--;
  return { peaks, gmax, first: fi / PR, last: (li + 1) / PR };
}

/* ---------- FFT + vocal entry detection ---------- */
const FN = 1024;
const FH = 512;
const HANN = new Float64Array(FN).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FN));
const REV = new Uint32Array(FN);
for (let i = 0; i < FN; i++) {
  let r = 0;
  for (let j = 0; j < 10; j++) r |= ((i >> j) & 1) << (9 - j);
  REV[i] = r;
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 0; i < n; i++) {
    const j = REV[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const h = size >> 1;
    const ang = (-2 * Math.PI) / size;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let st = 0; st < n; st += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = st + k, b = a + h;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

// Harmonic (sustained, pitched) energy in the voice band rising and staying up = vocals.
async function vocalEntry(x: Float32Array, SR: number, first: number): Promise<number | null> {
  const n = Math.min(x.length, Math.floor(95 * SR));
  const nF = Math.floor((n - FN) / FH);
  if (nF < 60) return null;
  const k0 = Math.ceil((300 * FN) / SR), k1 = Math.floor((3500 * FN) / SR), nb = k1 - k0 + 1;
  const S = new Float32Array(nF * nb);
  const re = new Float64Array(FN), im = new Float64Array(FN);
  for (let f = 0; f < nF; f++) {
    const o = f * FH;
    for (let i = 0; i < FN; i++) { re[i] = x[o + i] * HANN[i]; im[i] = 0; }
    fft(re, im);
    for (let k = k0; k <= k1; k++) S[f * nb + k - k0] = re[k] * re[k] + im[k] * im[k];
  }
  await yieldUI();
  const hb = new Float64Array(nF), tm = new Float32Array(17);
  for (let f = 0; f < nF; f++) {
    let acc = 0;
    const fa = Math.max(0, f - 4), fz = Math.min(nF - 1, f + 4);
    for (let b = 0; b < nb; b++) {
      let c = 0;
      for (let g = fa; g <= fz; g++) tm[c++] = S[g * nb + b];
      const h = tm.subarray(0, c).sort()[c >> 1];
      c = 0;
      for (let g = Math.max(0, b - 8), z = Math.min(nb - 1, b + 8); g <= z; g++) tm[c++] = S[f * nb + g];
      const p = tm.subarray(0, c).sort()[c >> 1];
      const v = S[f * nb + b], h2 = h * h;
      acc += (v * h2) / (h2 + p * p + 1e-30);
    }
    hb[f] = acc;
    if (f % 250 === 249) await yieldUI();
  }
  const fps = SR / FH, k = Math.round(2 * fps), sm = new Float64Array(nF);
  let run = 0;
  for (let f = 0; f < nF; f++) {
    run += hb[f];
    if (f >= k) run -= hb[f - k];
    sm[f] = run / k;
  }
  const f0 = Math.max(0, Math.floor(first * fps));
  const srt = Array.from(sm.subarray(f0)).sort((a, b) => a - b);
  const ref = srt[Math.floor(srt.length * 0.9)] || 1;
  const w3 = Math.round(3 * fps);
  for (let f = f0; f < nF - w3; f++) {
    if (sm[f] > 0.6 * ref) {
      let ok = true;
      for (let g = f; g < f + w3; g++) if (sm[g] < 0.36 * ref) { ok = false; break; }
      if (ok) return Math.max(first, (f * FH + FN / 2) / SR - 2);
    }
  }
  return null;
}

/* ---------- tempo + beat grid ---------- */
export async function analyze(buf: AudioBuffer, pk: Peaks): Promise<Analysis> {
  const dur = buf.duration;
  const SR = 11025, HOP = 64, len = Math.ceil(dur * SR);
  const off = new OfflineAudioContext(4, len, SR);
  const s = off.createBufferSource();
  const mg = off.createChannelMerger(4);
  s.buffer = buf;
  s.connect(mg, 0, 3);
  const band = (type: BiquadFilterType, fq: number, q: number, ch: number) => {
    const f = off.createBiquadFilter();
    f.type = type; f.frequency.value = fq;
    if (q) f.Q.value = q;
    s.connect(f); f.connect(mg, 0, ch);
  };
  band("lowpass", 150, 0, 0);
  band("bandpass", 800, 0.6, 1);
  band("highpass", 2500, 0, 2);
  mg.connect(off.destination);
  s.start();
  const rb = await off.startRendering();

  const F = Math.floor(len / HOP), fr = SR / HOP;
  const o2 = new Float32Array(F), o3 = new Float32Array(F), sm = new Float32Array(F), sa = new Float32Array(F);
  const e = new Float32Array(F), d = new Float32Array(F), cs = new Float64Array(F + 1);
  const W = Math.round(fr * 0.4);
  for (const [ch, wt] of [[0, 1], [1, 1], [2, 0.8]] as const) {
    const x = rb.getChannelData(ch);
    for (let i = 0; i < F; i++) {
      let a = 0;
      for (let j = i * HOP, k = j + HOP; j < k; j++) a += x[j] * x[j];
      e[i] = Math.log1p(1000 * a);
    }
    d[0] = 0;
    for (let i = 1; i < F; i++) d[i] = Math.max(0, e[i] - e[i - 1]);
    for (let i = 0; i < F; i++) cs[i + 1] = cs[i] + d[i];
    let ss = 0;
    for (let i = 0; i < F; i++) {
      const a = Math.max(0, i - W), b = Math.min(F, i + W);
      d[i] = Math.max(0, d[i] - (cs[b] - cs[a]) / (b - a));
      ss += d[i] * d[i];
    }
    const sd = Math.sqrt(ss / F) || 1;
    for (let i = 0; i < F; i++) {
      o2[i] += (wt * d[i]) / sd;
      if (ch < 2) o3[i] += d[i] / sd;
    }
    await yieldUI();
  }
  for (let i = 1; i < F - 1; i++) {
    sa[i] = 0.25 * o2[i - 1] + 0.5 * o2[i] + 0.25 * o2[i + 1];
    sm[i] = 0.25 * o3[i - 1] + 0.5 * o3[i] + 0.25 * o3[i + 1];
  }
  const lmin = Math.floor((fr * 60) / 185), lmax = Math.ceil((fr * 60) / 70);
  const acf = new Float32Array(2 * lmax + 2);
  for (let L = lmin; L <= 2 * lmax + 1; L++) {
    let t = 0;
    for (let i = L; i < F; i++) t += o2[i] * o2[i - L];
    acf[L] = t;
  }
  const sc = (L: number) => acf[L] + 0.5 * acf[2 * L];
  const peaksL: number[] = [];
  for (let L = lmin + 1; L < lmax; L++) if (sc(L) >= sc(L - 1) && sc(L) >= sc(L + 1)) peaksL.push(L);
  peaksL.sort((a, b) => sc(b) - sc(a));
  await yieldUI();
  const score = (p: number, ph: number, a: Float32Array) => {
    let t = 0, c = 0;
    for (let k = 0; ; k++) {
      const i = Math.round((ph + k * p) * fr);
      if (i >= F) break;
      t += a[i]; c++;
    }
    return c ? t / c : 0;
  };
  const phaseFor = (p: number): [number, number] => {
    let b = -1, bp = 0;
    for (let ph = 0; ph < p; ph += 1 / fr) {
      const t = score(p, ph, sm);
      if (t > b) { b = t; bp = ph; }
    }
    return [bp, b];
  };
  // a true tempo fits both its beats and the half-beats between them
  const tempoFit = (p: number) => {
    let b = -1;
    for (let ph = 0; ph < p / 2; ph += 1 / fr) {
      const t = score(p, ph, sa) + score(p, ph + p / 2, sa);
      if (t > b) b = t;
    }
    return b;
  };
  let best: [number, number] = [-1, (peaksL[0] || lmin) / fr];
  for (const L of peaksL.slice(0, 6)) {
    const p0 = L / fr;
    for (let k = -25; k <= 25; k++) {
      const p = p0 * (1 + k * 0.0006);
      const f = tempoFit(p);
      const w = Math.exp(-0.5 * Math.pow(Math.log2(60 / p / 110) / 1.2, 2));
      if (f * w > best[0]) best = [f * w, p];
    }
    await yieldUI();
  }
  let p = best[1], bpm = 60 / p;
  while (bpm < 75) { bpm *= 2; p /= 2; }
  while (bpm > 180) { bpm /= 2; p *= 2; }
  const ph = phaseFor(p)[0];
  const bars = [0, 0, 0, 0];
  for (let i = 0; ph + i * p < dur; i++) bars[i % 4] += sm[Math.round((ph + i * p) * fr)] || 0;
  const vox = await vocalEntry(rb.getChannelData(3), SR, pk.first);
  return { bpm, p, ph, down: bars.indexOf(Math.max(...bars)), first: pk.first, last: pk.last, vox, dur };
}

/* ---------- demo beats, synthesized in the browser ---------- */
export async function synthDemo(bpm: number, root: number, prog: number[]): Promise<AudioBuffer> {
  const SR = 44100, p = 60 / bpm, beats = 128;
  const c = new OfflineAudioContext(2, Math.ceil((beats * p + 1.5) * SR), SR);
  const out = c.createGain();
  out.gain.value = 0.55;
  out.connect(c.destination);
  const nb = c.createBuffer(1, SR, SR), nd = nb.getChannelData(0);
  for (let i = 0; i < SR; i++) nd[i] = Math.random() * 2 - 1;
  const env = (node: AudioNode, t: number, a: number, pk: number, dec: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.exponentialRampToValueAtTime(0.001, t + a + dec);
    node.connect(g); g.connect(out);
  };
  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const noise = (t: number, type: BiquadFilterType, fq: number, pk: number, dec: number) => {
    const s = c.createBufferSource(), f = c.createBiquadFilter();
    s.buffer = nb; f.type = type; f.frequency.value = fq;
    s.connect(f); env(f, t, 0.001, pk, dec);
    s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
  };
  for (let b = 0; b < beats; b++) {
    const t = 0.25 + b * p, sec = b >> 5, bar = b >> 2, q = b % 4, note = root + prog[bar % 4];
    const k = c.createOscillator();
    k.frequency.setValueAtTime(140, t);
    k.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(k, t, 0.002, q === 0 ? 1 : 0.85, 0.38);
    k.start(t); k.stop(t + 0.45);
    noise(t + p / 2, "highpass", 7500, sec === 0 ? 0.1 : 0.2, 0.06);
    if (sec === 1 || sec === 2) {
      if (q % 2 === 1) noise(t, "bandpass", 1500, 0.35, 0.15);
      const o = c.createOscillator(), f = c.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = hz(note);
      f.type = "lowpass"; f.frequency.value = 520; f.Q.value = 5;
      o.connect(f); env(f, t + p / 2, 0.005, 0.3, p * 0.42);
      o.start(t + p / 2); o.stop(t + p);
    }
    if (sec === 2 && (q === 1 || q === 3))
      for (const iv of [24, 27, 31]) {
        const o = c.createOscillator(), f = c.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.value = hz(note + iv);
        f.type = "lowpass"; f.frequency.value = 2200;
        o.connect(f); env(f, t + p * 0.5, 0.005, 0.05, p * 0.4);
        o.start(t + p * 0.5); o.stop(t + p);
      }
  }
  return c.startRendering();
}
