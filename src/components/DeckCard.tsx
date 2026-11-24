"use client";
import NumberFlow from "@number-flow/react";
import { motion } from "motion/react";
import { fmt, type Slot } from "@/lib/engine";
import { useEngine, useTicker } from "@/lib/hooks";
import { Artwork } from "./Artwork";
import { MiniWave } from "./MiniWave";

export function DeckCard({ slot }: { slot: Slot }) {
  const e = useEngine();
  useTicker(4);
  const v = e.deckView(slot);
  const t = v.track;
  const live = v.state === "Mixing in" || v.state === "Mixing out";
  const stateCls = live ? "text-hot" : v.state === "Up next" || v.state === "Cued" ? "text-deck-b" : v.state === "Playing" ? "text-vox" : "text-ink";
  const rate = Math.abs(v.rate - 1) < 0.0005 ? "Original tempo" : `${v.rate > 1 ? "+" : "−"}${Math.abs((v.rate - 1) * 100).toFixed(1)}% tempo`;
  const cue = t ? e.cueOf(t) : null;
  return (
    <motion.article layout className={`card relative flex flex-col overflow-hidden rounded-[24px] p-5 transition-[border-color] ${live ? "border-hot/40" : ""}`}>
      {live && <div className={`pointer-events-none absolute inset-0 ${slot === "A" ? "bg-[radial-gradient(80%_60%_at_0%_0%,rgba(59,130,246,.12),transparent)]" : "bg-[radial-gradient(80%_60%_at_100%_0%,rgba(249,115,22,.12),transparent)]"}`} />}
      <header className="relative flex items-center gap-2.5">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white ${slot === "A" ? "bg-deck-a" : "bg-deck-b"}`}>{slot}</span>
        <span className={`font-medium ${stateCls}`}>{v.state}</span>
        {cue != null && <span className="mono ml-auto text-sm text-faint">vocals {fmt(cue)}{t?.cue != null ? "*" : ""}</span>}
      </header>
      <div className="relative mt-5 flex items-center gap-3.5">
        <Artwork track={t} className="h-14 w-14 shrink-0" rounded="rounded-xl" />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold tracking-tight">{t ? t.title : "Nothing loaded"}</div>
          <div className="truncate text-sm text-mute">{t ? t.artist : "Waiting for the next song"}</div>
        </div>
      </div>
      <div className="relative mt-5 flex items-end gap-2">
        <span className="mono text-[40px] font-semibold leading-none tracking-tight">
          {v.bpm ? <NumberFlow value={v.bpm} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} /> : "—"}
        </span>
        <span className="mono mb-1 text-xs text-mute">BPM</span>
        {t && <span className="ml-auto rounded-lg border border-line2 px-2.5 py-1 text-xs text-ink/90">{rate}</span>}
      </div>
      <div className="relative mt-5 rounded-xl bg-well px-2 py-1.5">
        <MiniWave track={t} deck={v.deck} slot={slot} className="h-12" />
      </div>
      <div className="mono relative mt-2 flex justify-between text-xs text-faint">
        <span>{fmt(v.pos)}</span>
        <span>{t ? "−" + fmt(t.dur - v.pos) : ""}</span>
      </div>
    </motion.article>
  );
}
