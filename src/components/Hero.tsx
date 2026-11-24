"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { fmt } from "@/lib/engine";
import { useEngine, useTicker } from "@/lib/hooks";
import { Artwork } from "./Artwork";

export function Hero() {
  const e = useEngine();
  useTicker(2);
  const t = e.cur?.track ?? e.tracks.find((x) => x.status === "ready") ?? null;
  const v = e.cur ? e.deckView(e.cur.slot) : null;
  const cue = t ? e.cueOf(t) : null;
  const mixing = !!(e.plan?.armed && e.now() >= e.plan.T);
  const state = !e.playing ? (t ? "Ready" : "Loading") : e.paused ? "Paused" : mixing ? "Mixing" : "Playing";
  const dot = state === "Playing" ? "bg-vox text-vox" : state === "Mixing" ? "bg-hot text-hot" : state === "Paused" ? "bg-amber text-amber" : "bg-faint text-faint";
  const bpm = v?.bpm ?? t?.bpm ?? 0;
  return (
    <header className="relative">
      <div className="pointer-events-none absolute -left-24 -top-32 h-[480px] w-[900px] max-w-[140%] transition-[background] duration-1000"
        style={{ background: `radial-gradient(closest-side, hsl(${t?.hue ?? 210} 60% 40% / .32), transparent)` }} />
      <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left lg:gap-8">
        <AnimatePresence mode="popLayout">
          <motion.div key={t?.id ?? "none"} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
            <Artwork track={t} badge className="h-44 w-44 shadow-2xl shadow-black/60 lg:h-[220px] lg:w-[220px]" rounded="rounded-[22px]" />
          </motion.div>
        </AnimatePresence>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-line2 bg-white/[.04] py-1 pl-3 pr-3.5 text-sm backdrop-blur">
            <span className={`live-dot h-2 w-2 rounded-full ${dot}`} />
            <span className="font-medium">{state}</span>
            {v && <><span className="text-faint">•</span><span className="mono text-[13px] font-semibold uppercase text-deck-a">Deck {v.slot} master</span></>}
          </div>
          <AnimatePresence mode="wait">
            <motion.h1 key={t?.id ?? "none"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
              className="mt-4 line-clamp-2 text-5xl font-bold leading-[1.02] tracking-[-0.035em] text-balance lg:text-[76px]">
              {t ? t.title : "Nonstop"}
            </motion.h1>
          </AnimatePresence>
          {t && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[15px] sm:justify-start">
              <span className="font-semibold">{t.artist}</span>
              <span className="text-faint">•</span>
              <span className="mono rounded-lg bg-white/[.07] px-2.5 py-1 text-sm"><NumberFlow value={bpm} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} /> BPM</span>
              <span className="mono text-sm text-mute">{fmt(t.dur)}</span>
              {cue != null && <><span className="text-faint">•</span><span className="mono text-sm text-vox">vocals at {fmt(cue)}</span></>}
              {t.key && <><span className="text-faint">•</span><span className="mono rounded-lg bg-deck-a/15 px-2.5 py-1 text-sm text-[#8fb8ff]" title={t.key.name + (t.keyEstimated ? " (estimated)" : "")}>Key {t.key.camelot}</span></>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
