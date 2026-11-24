"use client";
import { useRef } from "react";
import { fit, palette, useEngine, useFrame } from "@/lib/hooks";
import type { Deck, Slot, Track } from "@/lib/engine";

/** Whole-song waveform with playhead, the mix zone, and a clickable vocal cue. */
export function MiniWave({ track, deck, slot, className = "h-14" }: { track: Track | null; deck: Deck | null; slot: Slot; className?: string }) {
  const e = useEngine();
  const ref = useRef<HTMLCanvasElement>(null);
  useFrame(() => {
    const cv = ref.current;
    if (!cv) return;
    const [W, H, r] = fit(cv);
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    const t = track;
    if (!t || !t.peaks || !W) return;
    const c = palette(), col = slot === "A" ? c.a : c.b, per = t.peaks.length / W, now = e.now(), plan = e.plan;
    const px = deck ? (Math.max(0, e.posAt(deck, now)) / t.dur) * W : 0;
    if (plan && deck && plan.from === deck) {
      const a = (Math.max(0, plan.zA) / t.dur) * W, b = Math.min(W, (plan.zB / t.dur) * W);
      g.globalAlpha = 0.18; g.fillStyle = c.hot; g.fillRect(a, 0, b - a, H);
    }
    g.fillStyle = col;
    for (let x = 0; x < W; x += 2 * r) {
      let m = 0;
      for (let i = Math.floor(x * per), z = Math.floor((x + 2 * r) * per); i < z; i++) if (t.peaks[i] > m) m = t.peaks[i];
      const v = Math.max(r / 2, (m / t.gmax) * H * 0.46);
      g.globalAlpha = deck && x < px ? 1 : 0.35;
      g.beginPath();
      g.roundRect(x, H / 2 - v, Math.max(1, r * 1.2), 2 * v, r);
      g.fill();
    }
    if (plan && plan.next === t && deck !== e.cur) {
      const a = (Math.max(0, e.beatT(t, plan.S)) / t.dur) * W;
      g.globalAlpha = 0.6; g.fillStyle = c.ink; g.fillRect(a, 0, 1.5 * r, H);
    }
    const cu = e.cueOf(t);
    if (cu != null) {
      const a = (cu / t.dur) * W;
      g.globalAlpha = 1; g.fillStyle = c.hot;
      g.fillRect(a - r, 0, 2 * r, H);
      g.beginPath(); g.moveTo(a - 5 * r, 0); g.lineTo(a + 5 * r, 0); g.lineTo(a, 7 * r); g.fill();
    }
    if (deck) { g.globalAlpha = 1; g.fillStyle = c.ink; g.fillRect(px - r, 0, 2 * r, H); }
  });
  const pick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!track || !track.dur) return;
    const rc = ev.currentTarget.getBoundingClientRect();
    e.setCueAt(track, ((ev.clientX - rc.left) / rc.width) * track.dur);
  };
  return (
    <canvas
      ref={ref}
      className={`block w-full cursor-pointer ${className}`}
      onClick={pick}
      onDoubleClick={() => track && e.setCueAt(track, null)}
      title="Click to set where the vocals start. Double-click to go back to auto."
      aria-label={track ? `Waveform of ${track.title}. Click to set the vocal cue.` : "Empty deck"}
    />
  );
}
