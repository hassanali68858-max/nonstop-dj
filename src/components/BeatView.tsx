"use client";
import { useRef } from "react";
import { fit, palette, useEngine, useFrame, useTicker } from "@/lib/hooks";
import type { Slot } from "@/lib/engine";

/** Both decks' waveforms scrolling past a centre playhead, with beat and bar lines. */
export function BeatView() {
  const e = useEngine();
  useTicker(2);
  const ref = useRef<HTMLCanvasElement>(null);
  useFrame(() => {
    const cv = ref.current;
    if (!cv) return;
    const [W, H, r] = fit(cv);
    const g = cv.getContext("2d")!;
    if (!W || !H) return;
    g.clearRect(0, 0, W, H);
    const c = palette(), now = e.now(), span = W / r < 600 ? 6 : 9, lh = H / 2;
    g.globalAlpha = 1;
    g.fillStyle = c.line;
    g.fillRect(0, lh - r / 2, W, r);
    (["A", "B"] as Slot[]).forEach((slot, li) => {
      const d = e.deckAt(slot);
      if (!d || !d.track.peaks) return;
      const t = d.track, peaks = d.track.peaks, mid = li * lh + lh / 2, amp = (lh * 0.4) / t.gmax;
      const col = slot === "A" ? c.a : c.b, gv = Math.max(0, Math.min(1, d.g.gain.value));
      let prev: number | null = null;
      for (let x = 0; x < W; x += 2 * r) {
        const tt = now + (x / W - 0.5) * span;
        if (tt < d.t0 || tt > d.stopAt) { prev = null; continue; }
        const pos = e.posAt(d, tt);
        if (pos < 0 || pos >= t.dur) { prev = null; continue; }
        const v = Math.max(r, peaks[Math.floor(pos * e.PR)] * amp);
        g.globalAlpha = (x < W / 2 ? 0.4 : 1) * (0.28 + 0.72 * gv);
        g.fillStyle = col;
        g.fillRect(x, mid - v, Math.max(1, 1.3 * r), v * 2);
        const bi = Math.floor((pos - t.ph) / t.p);
        if (prev !== null && bi !== prev) {
          const bar = e.barAlign(t, bi, 4) === 0;
          g.globalAlpha = bar ? 0.75 : 0.22;
          g.fillStyle = c.ink;
          if (bar) g.fillRect(x, li * lh + 8 * r, 1.5 * r, lh - 16 * r);
          else g.fillRect(x, mid - lh * 0.28, r, lh * 0.56);
        }
        prev = bi;
      }
    });
    if (!e.live.length) return;
    g.globalAlpha = 1;
    g.fillStyle = c.hot;
    g.fillRect(W / 2 - r, 0, 2 * r, H);
  });
  const lane = (slot: Slot) => {
    const v = e.deckView(slot);
    return v.deck ? `${v.track!.title} · ${v.bpm!.toFixed(1)} BPM` : null;
  };
  const la = lane("A"), lb = lane("B");
  return (
    <div className="relative h-[180px] lg:h-[220px] rounded-2xl bg-well/80 ring-1 ring-line overflow-hidden backdrop-blur">
      <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-label="Beat view of both decks" />
      {(["A", "B"] as Slot[]).map((s, i) => {
        const text = i ? lb : la;
        return text ? (
          <div key={s} className={`absolute left-3 ${i ? "top-[calc(50%+10px)]" : "top-2.5"} flex items-center gap-2 rounded-full bg-well/85 pr-3 pl-1 py-0.5 text-xs text-mute max-w-[calc(100%-24px)]`}>
            <span className={`grid place-items-center w-5 h-5 rounded-full text-[11px] font-bold text-white ${s === "A" ? "bg-deck-a" : "bg-deck-b"}`}>{s}</span>
            <span className="truncate">{text}</span>
          </div>
        ) : null;
      })}
      {!la && !lb && (
        <div className="absolute inset-0 grid place-items-center text-sm text-mute">Press play and watch the beats line up here</div>
      )}
    </div>
  );
}
