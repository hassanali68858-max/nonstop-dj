// Nonstop mix engine: two decks, beat-matched, vocal-timed transitions.
import { analyze, computePeaks, detectKey, findSections, synthDemo, PR, type Analysis, type KeyInfo, type Section } from "./analysis";

export const MAX_TRACKS = 10;
export type Style = "auto" | "swap" | "filter" | "echo";
export type Slot = "A" | "B";
export const STYLE_NAMES: Record<Exclude<Style, "auto">, string> = {
  swap: "Bass swap",
  filter: "Filter sweep",
  echo: "Echo out",
};

export interface Options {
  style: Style;
  blend: number; // seconds
  enter: "vocals" | "start";
  shift: number; // max tempo change, e.g. 0.08
  loop: boolean;
  vol: number;
  sync: boolean; // Auto-Sync: beat-match when possible
}

export type TrackStatus = "queued" | "loading" | "analyzing" | "ready" | "error";

export interface Track extends Analysis {
  id: string;
  title: string;
  artist: string;
  src?: string;
  file?: File | null;
  status: TrackStatus;
  buf?: AudioBuffer | null;
  peaks?: Float32Array;
  gmax: number;
  cue: number | null; // user-set vocal cue
  hue: number;
  pre?: Partial<Analysis>;
  key?: KeyInfo;
  keyEstimated?: boolean;
  preKey?: KeyInfo;
  sections: Section[];
}

export interface Deck {
  track: Track;
  slot: Slot;
  t0: number;
  off0: number;
  r0: number;
  r1: number;
  ra: number;
  rb: number;
  stopAt: number;
  src: AudioBufferSourceNode;
  low: BiquadFilterNode;
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  g: GainNode;
  send: GainNode;
  ehp: BiquadFilterNode;
  dl: DelayNode;
  fb: GainNode;
}

export interface Plan {
  from: Deck;
  next: Track;
  style: Exclude<Style, "auto">;
  k: number;
  r1: number;
  ramp: boolean;
  L: number;
  S: number;
  Vb: number;
  usedCue: boolean;
  T: number; // blend starts
  E: number; // old song gone, vocals hit
  Ta: number; // ramp starts (== T without ramp)
  zA: number;
  zB: number;
  match: boolean;
  want: number;
  M: number; // echo: old song cut
  armed: boolean;
  done?: number;
  deck?: Deck;
}

export interface DeckView {
  slot: Slot;
  track: Track | null;
  deck: Deck | null;
  state: string;
  bpm: number | null;
  rate: number;
  pos: number;
}

const ARM = 8;
const RB = 8;
const HUES = [208, 24, 340, 268, 150, 45, 190, 300, 120, 0];

const beatT = (t: Track, i: number) => t.ph + i * t.p;
const barAlign = (t: Track, i: number, g: number) => (((i - t.down) % g) + g) % g;
function entryBeat(t: Track) {
  let i = Math.max(0, Math.ceil((t.first - 0.03 - t.ph) / t.p));
  while (barAlign(t, i, 4)) i++;
  return i;
}
const curve = (up: boolean, sc = 1) => {
  const a = new Float32Array(64);
  for (let i = 0; i < 64; i++) {
    const x = ((i / 63) * Math.PI) / 2;
    a[i] = sc * (up ? Math.sin(x) : Math.cos(x));
  }
  return a;
};
const hold = (prm: AudioParam, now: number) => {
  prm.cancelScheduledValues(now);
  prm.setValueAtTime(prm.value, now);
};
export const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

const DEFAULTS: Options = { style: "auto", blend: 10, enter: "vocals", shift: 0.08, loop: true, vol: 0.85, sync: true };

type Listener = () => void;

export class Engine {
  tracks: Track[] = [];
  live: Deck[] = [];
  cur: Deck | null = null;
  plan: Plan | null = null;
  playing = false;
  paused = false;
  opt: Options = { ...DEFAULTS };
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  version = 0;
  booted = false;
  private uid = 0;
  private loading = false;
  private listeners = new Set<Listener>();
  private toastListeners = new Set<(m: string) => void>();
  private cues: Record<string, number> = {};

  constructor() {
    try {
      Object.assign(this.opt, JSON.parse(localStorage.getItem("nonstop-opt-v2") || "{}"));
      this.cues = JSON.parse(localStorage.getItem("nonstop-cues") || "{}");
    } catch {}
    setInterval(() => this.tick(), 100);
  }

  /* ---------- store plumbing ---------- */
  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  onToast(fn: (m: string) => void) {
    this.toastListeners.add(fn);
    return () => this.toastListeners.delete(fn);
  }
  private emit() {
    this.version++;
    this.listeners.forEach((f) => f());
  }
  toast(m: string) {
    this.toastListeners.forEach((f) => f(m));
  }
  private save() {
    try {
      localStorage.setItem("nonstop-opt-v2", JSON.stringify(this.opt));
      localStorage.setItem("nonstop-cues", JSON.stringify(this.cues));
    } catch {}
  }

  ac() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new C();
    const master = ctx.createGain();
    master.gain.value = this.opt.vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 8; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    return ctx;
  }
  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /* ---------- adding songs ---------- */
  private blank(id: string, title: string, artist: string): Track {
    return {
      id, title, artist, status: "queued", gmax: 1, cue: null, sections: [], hue: HUES[this.uid % HUES.length],
      bpm: 0, p: 0.5, ph: 0, down: 0, first: 0, last: 0, vox: null, dur: 0,
    };
  }
  async loadManifest(url: string) {
    if (this.booted) return;
    this.booted = true;
    try {
      const res = await fetch(url);
      const m = (await res.json()) as { tracks: { id: string; title: string; artist: string; src: string; analysis?: Partial<Analysis>; key?: KeyInfo }[] };
      for (const t of m.tracks.slice(0, MAX_TRACKS - this.tracks.length)) {
        const tr = this.blank(t.id + "-" + ++this.uid, t.title, t.artist);
        tr.src = t.src;
        tr.pre = t.analysis;
        tr.preKey = t.key;
        this.tracks.push(tr);
      }
      this.emit();
      this.pump();
    } catch (e) {
      console.error(e);
    }
  }
  addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(f.name));
    if (!files.length) return this.toast("Those weren't audio files.");
    const room = MAX_TRACKS - this.tracks.length;
    if (room <= 0) return this.toast(`The set holds ${MAX_TRACKS} songs. Remove one to add another.`);
    if (files.length > room) this.toast(`Only ${MAX_TRACKS} songs fit, so the first ${room} were added.`);
    for (const f of files.slice(0, room)) {
      const tr = this.blank("f" + ++this.uid, f.name.replace(/\.[^.]+$/, ""), "Your file");
      tr.file = f;
      this.tracks.push(tr);
    }
    this.emit();
    this.pump();
  }
  async addDemos() {
    const demos: [string, number, number, number[]][] = [
      ["Night Drive", 122, 33, [0, 0, 3, -2]],
      ["Tile Floor", 126, 36, [0, 5, 3, 7]],
      ["Afterglow", 117, 31, [0, 3, 5, 3]],
    ];
    const room = MAX_TRACKS - this.tracks.length;
    if (room <= 0) return this.toast(`The set holds ${MAX_TRACKS} songs.`);
    this.ac();
    const items = demos.slice(0, room).map(([n]) => {
      const t = this.blank("demo" + ++this.uid, n, "Demo beat");
      t.status = "loading";
      this.tracks.push(t);
      return t;
    });
    this.emit();
    for (let i = 0; i < items.length; i++) {
      const [, bpm, root, prog] = demos[i];
      items[i].buf = await synthDemo(bpm, root, prog);
      items[i].status = "queued";
    }
    this.pump();
  }
  private async pump() {
    if (this.loading) return;
    this.loading = true;
    let t: Track | undefined;
    while ((t = this.tracks.find((x) => x.status === "queued"))) {
      t.status = "loading";
      this.emit();
      try {
        const ctx = this.ac();
        if (!t.buf) {
          const data = t.file ? await t.file.arrayBuffer() : await (await fetch(t.src!)).arrayBuffer();
          t.buf = await ctx.decodeAudioData(data);
        }
        t.file = null;
        const pk = computePeaks(t.buf);
        t.peaks = pk.peaks;
        t.gmax = pk.gmax;
        const pre = t.pre;
        if (pre && pre.bpm && pre.p && pre.ph != null && pre.down != null) {
          Object.assign(t, { bpm: pre.bpm, p: pre.p, ph: pre.ph, down: pre.down, vox: pre.vox ?? null, first: pk.first, last: pk.last, dur: t.buf.duration });
        } else {
          t.status = "analyzing";
          this.emit();
          Object.assign(t, await analyze(t.buf, pk));
        }
        if (t.preKey) t.key = t.preKey;
        else { t.key = await detectKey(t.buf); t.keyEstimated = true; }
        t.sections = findSections({ peaks: t.peaks!, p: t.p, ph: t.ph, down: t.down, first: t.first, last: t.last, vox: t.vox, dur: t.dur });
        t.cue = this.cues[this.ckey(t)] ?? null;
        t.status = "ready";
      } catch (e) {
        console.error(e);
        t.status = "error";
      }
      this.refreshPlan();
      this.emit();
    }
    this.loading = false;
  }
  private ckey(t: Track) {
    return t.title + "|" + Math.round(t.dur);
  }
  cueOf(t: Track) {
    return t.cue != null ? t.cue : t.vox;
  }

  /* ---------- decks ---------- */
  private makeDeck(t: Track, slot: Slot): Deck {
    const c = this.ac();
    const src = c.createBufferSource();
    src.buffer = t.buf!;
    const low = c.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 200;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 20;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 20000;
    const g = c.createGain();
    const send = c.createGain(); send.gain.value = 0;
    const ehp = c.createBiquadFilter(); ehp.type = "highpass"; ehp.frequency.value = 280;
    const dl = c.createDelay(2);
    const fb = c.createGain(); fb.gain.value = 0.55;
    src.connect(low); low.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.master!);
    lp.connect(send); send.connect(ehp); ehp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.master!);
    const d: Deck = { track: t, slot, t0: 0, off0: 0, r0: 1, r1: 1, ra: 0, rb: 0, stopAt: Infinity, src, low, hp, lp, g, send, ehp, dl, fb };
    src.onended = () => {
      const k = this.live.indexOf(d);
      if (k >= 0) this.live.splice(k, 1);
      setTimeout(() => {
        try { g.disconnect(); dl.disconnect(); fb.disconnect(); } catch {}
      }, 8000);
      this.emit();
    };
    this.live.push(d);
    return d;
  }
  private startDeck(d: Deck, T: number, off: number) {
    d.t0 = T;
    d.off0 = off;
    d.src.start(T, Math.max(0, off));
  }
  posAt(d: Deck, t: number) {
    if (t <= d.t0) return d.off0;
    const { ra: a, rb: b, r0, r1 } = d;
    if (!(b > a) || t <= a) return d.off0 + (t - d.t0) * r0;
    const pa = d.off0 + (a - d.t0) * r0, D = b - a;
    if (t <= b) {
      const x = t - a;
      return pa + r0 * x + ((r1 - r0) * x * x) / (2 * D);
    }
    return pa + ((r0 + r1) / 2) * D + r1 * (t - b);
  }
  rateAt(d: Deck, t: number) {
    const { ra: a, rb: b } = d;
    if (!(b > a) || t <= a) return d.r0;
    if (t >= b) return d.r1;
    return d.r0 + ((d.r1 - d.r0) * (t - a)) / (b - a);
  }
  private timeOf(d: Deck, pos: number) {
    let lo = d.t0, hi = d.t0 + Math.max(0, pos - d.off0) / Math.min(d.r0, d.r1) + 1;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2;
      if (this.posAt(d, m) < pos) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  deckAt(slot: Slot) {
    for (let i = this.live.length - 1; i >= 0; i--) if (this.live[i].slot === slot) return this.live[i];
    return null;
  }

  /* ---------- planning ---------- */
  nextTrack(): Track | null {
    if (!this.cur) return this.tracks.find((t) => t.status === "ready") || null;
    const i = this.tracks.indexOf(this.cur.track), n = this.tracks.length;
    for (let k = 1; k <= n; k++) {
      const j = i + k;
      if (j >= n && !this.opt.loop) return null;
      const t = this.tracks[j % n];
      if (t && t.status === "ready" && t !== this.cur.track) return t;
    }
    return null;
  }
  private tempoMatch(tr: Track, nt: Track) {
    // 1:1, half and double time first; then a 3:2 lock (e.g. 90 BPM into 135) if it is very close
    const best = (ks: number[]) => {
      let k = 1, r = 1, dev = 9;
      for (const kk of ks) {
        const rr = tr.p / (kk * nt.p);
        if (Math.abs(rr - 1) < dev) { dev = Math.abs(rr - 1); r = rr; k = kk; }
      }
      return { k, r, dev };
    };
    const a = best([0.5, 1, 2]);
    if (a.dev <= this.opt.shift + 1e-9) return { ...a, match: true };
    const b = best([2 / 3, 1.5]);
    if (b.dev <= Math.min(this.opt.shift, 0.04) + 1e-9) return { ...b, match: true };
    return { ...a, match: false };
  }
  private computePlan(d: Deck, nt: Track, forceMo?: number): Plan {
    const tr = d.track, m = this.tempoMatch(tr, nt);
    let style: Plan["style"] = this.opt.style === "auto" ? "swap" : this.opt.style;
    if (!m.match || !this.opt.sync) style = "echo";
    const echo = style === "echo";
    const k = echo ? 1 : m.k, r1 = echo ? 1 : m.r, ramp = Math.abs(r1 - 1) > 1e-4;
    // overlap length in incoming beats must keep both songs' bars aligned
    const step = Math.abs(k - 1.5) < 1e-6 ? 12 : Math.abs(k - 2 / 3) < 1e-6 ? 8 : 4;
    let Lov = Math.max(step, Math.round(this.opt.blend / nt.p / step) * step);
    let solo = echo ? 8 : 0; // echo: let the new groove run alone for 2 bars before the vocals
    const ent = entryBeat(nt), cue = this.opt.enter === "vocals" ? this.cueOf(nt) : null;
    let Vb: number, usedCue = false;
    if (cue != null && cue > beatT(nt, ent) + 0.5) {
      Vb = Math.round((cue - nt.ph) / nt.p);
      const a = barAlign(nt, Vb, 4);
      Vb += a === 3 ? 1 : -a;
      const avail = Vb - ent;
      if (echo) solo = avail >= Lov + 8 ? 8 : avail >= 12 ? 4 : 0;
      if (avail - solo >= step) Lov = Math.min(Lov, Math.floor((avail - solo) / step) * step);
      usedCue = true;
    } else Vb = ent + Lov + solo;
    const L = Lov + solo, S = Vb - L, Lo = Math.round(Lov / k), lastI = Math.floor((tr.last - tr.ph) / tr.p);
    let Eo: number;
    if (forceMo != null) Eo = forceMo + Lo;
    else {
      Eo = lastI;
      while (Eo > 0 && barAlign(tr, Eo, 4)) Eo--;
    }
    const Mo = Eo - Lo;
    let T: number, E: number, Ta: number, M: number;
    if (echo) {
      M = this.timeOf(d, beatT(tr, Eo));
      T = M - Lov * nt.p;
      E = M + solo * nt.p;
      Ta = T;
    } else {
      Ta = this.timeOf(d, beatT(tr, Mo - (ramp ? RB : 0)));
      T = ramp ? Ta + (2 * RB * tr.p) / (1 + r1) : Ta;
      E = T + L * nt.p;
      M = E;
    }
    const zA = echo ? beatT(tr, Eo) - (M - T) : beatT(tr, Mo - (ramp ? RB : 0));
    return { from: d, next: nt, style, k, r1, ramp, L, S, Vb, usedCue, T, E, Ta, M, zA, zB: beatT(tr, Eo), match: m.match, want: m.dev, armed: false };
  }
  private planNow(nt: Track) {
    const cur = this.cur!, tr = cur.track, m = this.tempoMatch(tr, nt), now = this.now();
    const ramp = m.match && this.opt.sync && this.opt.style !== "echo" && Math.abs(m.r - 1) > 1e-4;
    let b = Math.ceil((this.posAt(cur, now + 0.6) - tr.ph) / tr.p) + (ramp ? RB : 0);
    while (barAlign(tr, b, 4)) b++;
    let P = this.computePlan(cur, nt, b);
    for (let i = 0; i < 8 && P.Ta < now + 0.3; i++) {
      b += 4;
      P = this.computePlan(cur, nt, b);
    }
    return P;
  }
  private refreshPlan() {
    if (!this.ctx || !this.cur || !this.playing || (this.plan && this.plan.armed)) return;
    const nt = this.nextTrack();
    if (!nt) { this.plan = null; return; }
    this.plan = this.computePlan(this.cur, nt);
    if (this.plan.Ta < this.now() + 0.5) this.plan = this.planNow(nt);
  }
  private arm(P: Plan) {
    const o = P.from, nt = P.next, { T, E, L, style, S, Ta, r1 } = P, now = this.now(), B = nt.p, H = T + (L / 2) * B;
    const d = this.makeDeck(nt, o.slot === "A" ? "B" : "A");
    for (const prm of [o.g.gain, o.low.gain, o.hp.frequency, o.lp.frequency, o.send.gain]) hold(prm, now);
    if (P.ramp) {
      o.r0 = 1; o.r1 = r1; o.ra = Ta; o.rb = T;
      o.src.playbackRate.setValueAtTime(1, Ta);
      o.src.playbackRate.linearRampToValueAtTime(r1, T);
    }
    if (style === "echo") {
      // The new song's intro takes over while the old one muffles, then the old song's
      // last beat is thrown into an echo and the new groove runs alone until the vocals.
      const Bo = o.track.p, M = P.M;
      o.dl.delayTime.value = Math.min(1.9, Bo * 0.75);
      o.lp.frequency.setValueAtTime(20000, T);
      o.lp.frequency.exponentialRampToValueAtTime(700, M);
      o.g.gain.setValueAtTime(1, T);
      o.g.gain.linearRampToValueAtTime(0.6, M - 0.012);
      o.g.gain.linearRampToValueAtTime(0, M + 0.01);
      o.send.gain.setValueAtTime(0, M - Bo);
      o.send.gain.linearRampToValueAtTime(0.8, M - Bo + 0.02);
      o.send.gain.setValueAtTime(0.8, M - 0.01);
      o.send.gain.linearRampToValueAtTime(0, M + 0.01);
      d.hp.frequency.value = 300;
      d.hp.frequency.setValueAtTime(300, T);
      d.hp.frequency.exponentialRampToValueAtTime(20, M);
      d.g.gain.value = 0;
      d.g.gain.setValueCurveAtTime(curve(true, 0.9), T, Math.max(0.05, M - T));
      d.g.gain.linearRampToValueAtTime(1, M + 0.4);
    } else {
      const fin = style === "swap" ? H : T + (L / 4) * B, fo = style === "swap" ? H : T + ((3 * L) / 4) * B;
      d.g.gain.value = 0;
      d.g.gain.setValueCurveAtTime(curve(true), T, fin - T);
      d.low.gain.value = -30;
      d.low.gain.setValueAtTime(-30, H - 0.03);
      d.low.gain.linearRampToValueAtTime(0, H + 0.03);
      o.low.gain.setValueAtTime(0, H - 0.03);
      o.low.gain.linearRampToValueAtTime(-30, H + 0.03);
      o.g.gain.setValueCurveAtTime(curve(false), fo, E - fo);
      o.hp.frequency.setValueAtTime(20, style === "swap" ? H : T);
      o.hp.frequency.exponentialRampToValueAtTime(style === "swap" ? 350 : 1200, E);
      if (style === "filter") {
        d.lp.frequency.value = 300;
        d.lp.frequency.setValueAtTime(300, T);
        d.lp.frequency.exponentialRampToValueAtTime(20000, E);
      }
    }
    const off = beatT(nt, S);
    if (off < 0) this.startDeck(d, T - off, 0);
    else this.startDeck(d, T, off);
    const end = style === "echo" ? P.M : E;
    o.stopAt = end + 0.05;
    o.src.stop(end + 0.05);
    P.done = end + 0.05;
    P.armed = true;
    P.deck = d;
  }
  private tick() {
    if (!this.ctx || !this.playing || this.paused || !this.cur) return;
    const now = this.now();
    const plan = this.plan;
    if (plan && plan.armed) {
      if (now >= plan.done!) {
        this.cur = plan.deck!;
        this.plan = null;
        this.refreshPlan();
        this.emit();
      }
      return;
    }
    if (!plan) this.refreshPlan();
    if (this.plan) {
      if (this.plan.Ta - now < ARM) {
        if (this.plan.Ta - now < 0.3) this.plan = this.planNow(this.plan.next);
        this.arm(this.plan);
        this.emit();
      }
    } else if (this.posAt(this.cur, now) >= this.cur.track.dur) {
      this.playing = false;
      this.cur = null;
      this.emit();
      this.toast("That was the last song. Set finished.");
    }
  }

  /* ---------- transport ---------- */
  private stopAll() {
    for (const d of [...this.live]) {
      try {
        d.g.gain.cancelScheduledValues(0);
        d.g.gain.value = 0;
        d.fb.gain.value = 0;
        d.src.stop();
      } catch {}
    }
    this.live.length = 0;
    this.cur = null;
    this.plan = null;
  }
  async playFrom(t: Track, offset = 0, slot: Slot = "A") {
    const c = this.ac();
    if (c.state !== "running") await c.resume();
    this.stopAll();
    this.paused = false;
    const d = this.makeDeck(t, slot), T = c.currentTime + 0.06;
    d.g.gain.setValueAtTime(0, T);
    d.g.gain.linearRampToValueAtTime(1, T + 0.08);
    this.startDeck(d, T, offset);
    this.cur = d;
    this.playing = true;
    this.refreshPlan();
    this.emit();
  }
  async toggle() {
    const c = this.ac();
    if (this.playing && !this.paused) {
      await c.suspend();
      this.paused = true;
    } else if (this.playing && this.paused) {
      await c.resume();
      this.paused = false;
    } else {
      const t = this.tracks.find((x) => x.status === "ready");
      if (!t) return this.toast(this.tracks.length ? "Still loading. One moment." : "Add some songs first.");
      await this.playFrom(t);
    }
    this.emit();
  }
  async mixInto(t: Track) {
    if (this.paused && this.ctx) { await this.ctx.resume(); this.paused = false; }
    if (!this.playing || !this.cur) return this.playFrom(t);
    if (t === this.cur.track) return;
    if (this.plan && this.plan.armed) return this.toast("A mix is already under way. Try again when it lands.");
    this.plan = this.planNow(t);
    this.arm(this.plan);
    this.emit();
  }
  mixNow() {
    if (!this.playing || !this.cur || this.paused) return this.toast("Start playing first.");
    const nt = this.nextTrack();
    if (!nt) return this.toast("There's no next song to mix into.");
    this.mixInto(nt);
  }
  prev() {
    if (!this.cur) return;
    if (this.plan && this.plan.armed) return this.toast("Mixing right now. Try again in a moment.");
    const pos = this.posAt(this.cur, this.now());
    if (pos > 4) return this.seek(0);
    const i = this.tracks.indexOf(this.cur.track);
    for (let k = 1; k <= this.tracks.length; k++) {
      const t = this.tracks[(i - k + this.tracks.length * 2) % this.tracks.length];
      if (t && t.status === "ready") return this.playFrom(t);
    }
  }
  seek(sec: number) {
    if (!this.cur) return;
    if (this.plan && this.plan.armed) return this.toast("Mixing right now. Seek after the blend lands.");
    const t = this.cur.track;
    const wasPaused = this.paused;
    this.playFrom(t, Math.max(0, Math.min(t.dur - 1, sec)), this.cur.slot).then(async () => {
      if (wasPaused && this.ctx) { await this.ctx.suspend(); this.paused = true; this.emit(); }
    });
  }

  /* ---------- playlist + settings ---------- */
  move(t: Track, delta: number) {
    const i = this.tracks.indexOf(t), j = i + delta;
    if (i < 0 || j < 0 || j >= this.tracks.length) return;
    this.tracks.splice(i, 1);
    this.tracks.splice(j, 0, t);
    this.refreshPlan();
    this.emit();
  }
  remove(t: Track) {
    if (this.plan && this.plan.armed && this.plan.next === t) return this.toast("That song is mixing in right now.");
    const i = this.tracks.indexOf(t);
    if (i < 0) return;
    this.tracks.splice(i, 1);
    if (!(this.cur && this.cur.track === t) && !(this.plan && this.plan.next === t)) t.buf = null;
    this.refreshPlan();
    this.emit();
  }
  sortByTempo() {
    const r = this.tracks.filter((t) => t.status === "ready").sort((a, b) => a.bpm - b.bpm);
    const o = this.tracks.filter((t) => t.status !== "ready");
    this.tracks.splice(0, this.tracks.length, ...r, ...o);
    this.refreshPlan();
    this.emit();
    this.toast("Sorted slowest to fastest, so neighbouring songs can beat-match.");
  }
  setOpt(p: Partial<Options>) {
    Object.assign(this.opt, p);
    if (p.vol != null && this.master && this.ctx) this.master.gain.setTargetAtTime(p.vol, this.ctx.currentTime, 0.02);
    this.save();
    this.refreshPlan();
    this.emit();
  }
  setCueAt(t: Track, sec: number | null) {
    if (sec == null) {
      t.cue = null;
      delete this.cues[this.ckey(t)];
      this.toast(t.vox != null ? `Back to the detected vocal start, ${fmt(t.vox)}.` : "No vocals detected; it will enter from its start.");
    } else {
      let b = Math.round((sec - t.ph) / t.p);
      const a = barAlign(t, b, 4);
      b += a <= 2 ? -a : 4 - a;
      const x = Math.max(0, beatT(t, b));
      t.cue = x;
      this.cues[this.ckey(t)] = x;
      this.toast(`Vocals for "${t.title}" set to ${fmt(x)}.`);
    }
    this.save();
    this.refreshPlan();
    this.emit();
  }

  /* ---------- views for the UI ---------- */
  deckView(slot: Slot, now = this.now()): DeckView {
    const d = this.deckAt(slot), plan = this.plan, cur = this.cur;
    let t: Track | null = d ? d.track : null, state = "Empty";
    if (d) {
      if (d === cur) state = plan && plan.armed && now >= plan.T ? "Mixing out" : "Playing";
      else if (plan && plan.deck === d) state = now < d.t0 ? "Cued" : "Mixing in";
      else state = "Ending";
    } else if (plan && cur && cur.slot !== slot) {
      t = plan.next;
      state = "Up next";
    } else if (!cur && slot === "A") {
      t = this.tracks.find((x) => x.status === "ready") || null;
      state = t ? "Ready" : "Empty";
    }
    if (this.paused && d) state = "Paused";
    const rate = d ? this.rateAt(d, Math.max(now, d.t0)) : 1;
    const pos = d && t ? Math.min(t.dur, Math.max(0, this.posAt(d, now))) : 0;
    return { slot, track: t, deck: d, state, bpm: t ? t.bpm * rate : null, rate, pos };
  }
  mixInfo(now = this.now()) {
    const plan = this.plan;
    if (!this.playing || !this.cur) return null;
    if (!plan) return { title: "Last song", detail: this.opt.loop ? "Add another song to keep the set going" : "Loop is off, so the set ends here", progress: 0, left: 0, active: false };
    const left = plan.T - now;
    const progress = Math.max(0, Math.min(1, (now - plan.T) / (plan.E - plan.T)));
    const lock = Math.abs(plan.k - 1.5) < 1e-6 || Math.abs(plan.k - 2 / 3) < 1e-6 ? "3:2 beat lock" : "";
    const tempo = plan.style === "echo"
      ? `new beat leads for ${Math.round(plan.E - plan.M)}s`
      : [lock, plan.ramp ? `ending song ${plan.r1 > 1 ? "+" : "−"}${Math.abs((plan.r1 - 1) * 100).toFixed(1)}%` : "tempos match"].filter(Boolean).join(", ");
    return {
      title: left > 0 ? `Next mix in ${fmt(left)}` : `Mixing · ${Math.round(progress * 100)}%`,
      detail: [STYLE_NAMES[plan.style], `${Math.round((plan.style === "echo" ? plan.M : plan.E) - plan.T)}s blend`, tempo, plan.usedCue ? (plan.style === "echo" ? "then vocals" : "vocals hit as it ends") : "next song from its start"].filter(Boolean).join(" · "),
      style: STYLE_NAMES[plan.style],
      next: plan.next,
      progress,
      left,
      active: left <= 0,
    };
  }
  crossfade() {
    const A = this.deckAt("A"), B = this.deckAt("B");
    const ga = A ? A.g.gain.value : 0, gb = B ? B.g.gain.value : 0;
    if (ga + gb > 0.001) return gb / (ga + gb);
    return this.cur ? (this.cur.slot === "A" ? 0 : 1) : 0.5;
  }
  beatT = beatT;
  barAlign = barAlign;
  PR = PR;
}

let instance: Engine | null = null;
export function getEngine() {
  if (typeof window === "undefined") return null;
  if (!instance) {
    instance = new Engine();
    (window as unknown as { __nonstop: Engine }).__nonstop = instance;
  }
  return instance;
}
