"use client";
import { useRef } from "react";
import { fit, palette, useEngine, useFrame } from "@/lib/hooks";
import type { Slot } from "@/lib/engine";

/** Both decks scrolling past a centre playhead with beat and bar lines: you can see the beats lock. */
export function BeatCanvas() {
  const e = useEngine();
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
      const t = d.track, peaks = t.peaks!, mid = li * lh + lh / 2, amp = (lh * 0.4) / t.gmax;
      const col = slot === "A" ? c.a : c.b, gv = Math.max(0, Math.min(1, d.g.gain.value));
      let prev: number | null = null;
      for (let x = 0; x < W; x += 3 * r) {
        const tt = now + (x / W - 0.5) * span;
        if (tt < d.t0 || tt > d.stopAt) { prev = null; continue; }
        const pos = e.posAt(d, tt);
        if (pos < 0 || pos >= t.dur) { prev = null; continue; }
        const v = Math.max(r, peaks[Math.floor(pos * e.PR)] * amp);
        g.globalAlpha = (x < W / 2 ? 0.35 : 0.95) * (0.25 + 0.75 * gv);
        g.fillStyle = col;
        g.beginPath(); g.roundRect(x, mid - v, 2 * r, v * 2, r); g.fill();
        const bi = Math.floor((pos - t.ph) / t.p);
        if (prev !== null && bi !== prev) {
          const bar = e.barAlign(t, bi, 4) === 0;
          g.globalAlpha = bar ? 0.7 : 0.18;
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
  return (
    <div className="relative h-full w-full">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-label="Beat-lock view of both decks" />
      {(["A", "B"] as Slot[]).map((s, i) => {
        const v = e.deckView(s);
        return v.deck ? (
          <div key={s} className={`absolute left-3 ${i ? "top-[calc(50%+10px)]" : "top-2.5"} mono flex max-w-[calc(100%-24px)] items-center gap-2 rounded-full bg-black/50 py-0.5 pl-1 pr-3 text-xs text-mute backdrop-blur`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${s === "A" ? "bg-deck-a" : "bg-deck-b"}`}>{s}</span>
            <span className="truncate">{v.track!.title} · {v.bpm!.toFixed(1)}</span>
          </div>
        ) : null;
      })}
      {!e.live.length && <div className="absolute inset-0 grid place-items-center text-sm text-mute">Press play and watch the beats lock here</div>}
    </div>
  );
}
