"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmt, type Track } from "@/lib/engine";
import { fit, palette, useEngine, useFrame, useTicker } from "@/lib/hooks";
import { BeatCanvas } from "./BeatView";

/** Loudness envelope for drawing: averaged, normalised and contrast-stretched so loud masters still show shape. */
const envCache = new WeakMap<Track, { n: number; v: Float32Array }>();
function envelope(t: Track, n: number) {
  const c = envCache.get(t);
  if (c && c.n === n) return c.v;
  const pk = t.peaks!, per = pk.length / n, raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const k0 = Math.floor(i * per), k1 = Math.max(k0 + 1, Math.floor((i + 1) * per));
    for (let k = k0; k < k1; k++) s += pk[k] * pk[k];
    raw[i] = Math.sqrt(s / (k1 - k0));
  }
  const sorted = Array.from(raw).sort((a, b) => a - b), hi = sorted[Math.floor(n * 0.98)] || 1, lo = sorted[Math.floor(n * 0.1)] * 0.5;
  const v = raw.map((x) => Math.pow(Math.max(0, Math.min(1, (x - lo) / (hi - lo))), 1.6) * 0.92 + 0.04);
  envCache.set(t, { n, v });
  return v;
}

function Overview({ t }: { t: Track | null }) {
  const e = useEngine();
  const ref = useRef<HTMLCanvasElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const flag = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const cv = ref.current;
    if (!cv) return;
    const [W, H, r] = fit(cv);
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    if (!t || !t.peaks || !W) return;
    const c = palette(), d = e.cur && e.cur.track === t ? e.cur : null, plan = e.plan;
    const pos = d ? Math.max(0, Math.min(t.dur, e.posAt(d, e.now()))) : 0;
    const px = (pos / t.dur) * W;
    const zone = plan && d && plan.from === d ? [Math.max(0, plan.zA) / t.dur * W, Math.min(W, plan.zB / t.dur * W)] : null;
    // sections
    g.fillStyle = c.line;
    for (const s of t.sections) if (s.t > 0) g.fillRect((s.t / t.dur) * W, 0, r, H);
    if (zone) {
      const grd = g.createLinearGradient(zone[0], 0, zone[1], 0);
      grd.addColorStop(0, "rgba(249,115,22,.16)"); grd.addColorStop(1, "rgba(249,115,22,.05)");
      g.fillStyle = grd; g.fillRect(zone[0], 0, zone[1] - zone[0], H);
      g.strokeStyle = "rgba(249,115,22,.9)"; g.lineWidth = 1.5 * r; g.setLineDash([4 * r, 4 * r]);
      g.beginPath(); g.moveTo(zone[0], 0); g.lineTo(zone[0], H); g.stroke(); g.setLineDash([]);
    }
    const bw = 3 * r, step = 5 * r, mid = H / 2;
    const blue = g.createLinearGradient(0, mid - H * 0.42, 0, mid + H * 0.42);
    blue.addColorStop(0, c.a); blue.addColorStop(0.5, "#6ea8ff"); blue.addColorStop(1, c.a);
    const env = envelope(t, Math.ceil(W / step));
    for (let x = 0, i = 0; x < W; x += step, i++) {
      const v = Math.max(1.5 * r, env[i] * H * 0.44);
      if (d && x + bw <= px) { g.fillStyle = blue; g.globalAlpha = 1; }
      else if (zone && x >= zone[0]) { g.fillStyle = c.b; g.globalAlpha = 0.45; }
      else { g.fillStyle = c.ink; g.globalAlpha = 0.16; }
      g.beginPath(); g.roundRect(x, mid - v, bw, 2 * v, 1.5 * r); g.fill();
    }
    g.globalAlpha = 1;
    if (d) {
      g.fillStyle = c.hot; g.fillRect(px - r, 0, 2 * r, H);
      g.beginPath(); g.moveTo(px - 6 * r, 0); g.lineTo(px + 6 * r, 0); g.lineTo(px, 8 * r); g.fill();
    }
    const cw = cv.clientWidth;
    if (tag.current) {
      tag.current.style.display = d ? "block" : "none";
      tag.current.textContent = fmt(pos);
      tag.current.style.transform = `translateX(${Math.min(cw - 52, Math.max(0, (px / W) * cw + 8))}px)`;
    }
    if (flag.current) {
      flag.current.style.display = zone ? "flex" : "none";
      if (zone) flag.current.style.transform = `translateX(${Math.min(cw - 96, (zone[0] / W) * cw + 10)}px)`;
    }
  });
  const seek = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!t || !e.cur || e.cur.track !== t) return;
    const rc = ev.currentTarget.getBoundingClientRect();
    e.seek(((ev.clientX - rc.left) / rc.width) * t.dur);
  };
  // section labels, with the outro blend taking priority when labels would collide
  const plan = e.plan;
  const labels: { t: number; label: string; hot?: boolean }[] = t ? t.sections.map((s) => ({ ...s })) : [];
  if (t && plan && e.cur && plan.from === e.cur && e.cur.track === t) labels.push({ t: Math.max(0, plan.zA), label: "Outro blend", hot: true });
  labels.sort((a, b) => a.t - b.t);
  const shown: typeof labels = [];
  for (const l of labels) {
    const last = shown[shown.length - 1];
    if (last && t && (l.t - last.t) / t.dur < 0.1) { if (!last.hot) shown[shown.length - 1] = l; continue; }
    shown.push(l);
  }
  return (
    <div>
      <div className="relative h-48 overflow-hidden rounded-2xl bg-well lg:h-[250px]">
        <canvas ref={ref} onClick={seek} className="absolute inset-0 h-full w-full cursor-pointer" aria-label="Song overview. Click to jump." />
        <div ref={tag} className="mono pointer-events-none absolute left-0 top-3 rounded-md bg-hot px-1.5 py-0.5 text-xs font-bold text-white shadow-lg" />
        <div ref={flag} className="mono pointer-events-none absolute left-0 top-3 items-center gap-1 rounded-md bg-deck-b px-1.5 py-0.5 text-[11px] font-bold uppercase text-black shadow-lg">⚑ Mix out</div>
      </div>
      <div className="relative mt-3 h-5">
        {t && shown.map((l) => {
          const pct = (l.t / t.dur) * 100;
          const right = pct > 78;
          return (
            <span key={l.label + l.t} className={`mono absolute top-0 whitespace-nowrap text-[11px] uppercase tracking-wider ${l.hot ? "font-semibold text-deck-b" : "text-faint"}`}
              style={right ? { right: `${Math.max(0, 100 - pct - 22)}%` } : { left: `${pct}%` }}>
              {l.label} • {fmt(l.t)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function TrackPanel() {
  const e = useEngine();
  useTicker(2);
  const [mode, setMode] = useState<"auto" | "overview" | "beats">("auto");
  const t = e.cur?.track ?? e.tracks.find((x) => x.status === "ready") ?? null;
  const v = e.cur ? e.deckView(e.cur.slot) : null;
  const plan = e.plan;
  const mixing = !!(plan?.armed && e.now() >= plan.Ta - 1.5);
  const view = mode === "auto" ? (mixing ? "beats" : "overview") : mode;
  const zoneSecs = plan && e.cur && plan.from === e.cur ? Math.round(plan.zB - Math.max(0, plan.zA)) : null;
  return (
    <section className="card rounded-[28px] p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${v?.slot === "B" ? "bg-deck-b" : "bg-deck-a"}`}>{v?.slot ?? "A"}</span>
          <span className="truncate font-semibold">{t ? t.title : "No song"}</span>
          {t && <span className="mono text-sm text-mute">• {(v?.bpm ?? t.bpm).toFixed(1)} BPM</span>}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {view === "overview" && (
            <div className="mono hidden items-center gap-4 text-xs text-mute sm:flex">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-deck-a" />Played</span>
              {zoneSecs != null && <span className="flex items-center gap-1.5 text-deck-b"><i className="h-2.5 w-2.5 rounded-[3px] bg-deck-b" />Mix out zone ({zoneSecs}s)</span>}
            </div>
          )}
          <div className="relative flex rounded-xl border border-line bg-black/20 p-0.5 text-xs font-medium" role="tablist">
            {(["overview", "beats"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={view === m} onClick={() => setMode(mode === m ? "auto" : m)}
                className={`relative z-10 h-7 rounded-[10px] px-3 transition-colors ${view === m ? "text-ink" : "text-mute hover:text-ink"}`}>
                {view === m && <motion.span layoutId="tp-tab" className="absolute inset-0 -z-10 rounded-[10px] bg-panel3" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                {m === "overview" ? "Overview" : "Beat-lock"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {view === "overview" ? <Overview t={t} /> : <div className="h-48 overflow-hidden rounded-2xl bg-well lg:h-[278px]"><BeatCanvas /></div>}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
