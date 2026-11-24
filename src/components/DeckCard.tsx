"use client";
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
  const rate = Math.abs(v.rate - 1) < 0.0005 ? "Original tempo" : `${v.rate > 1 ? "+" : "−"}${Math.abs((v.rate - 1) * 100).toFixed(1)}% tempo`;
  const cue = t ? e.cueOf(t) : null;
  return (
    <article className={`rounded-2xl p-4 ring-1 transition-colors ${v.deck ? "bg-elev ring-line" : "bg-elev/50 ring-transparent"}`}>
      <header className="flex items-center gap-2 text-xs">
        <span className={`grid place-items-center w-6 h-6 rounded-full font-bold text-white ${slot === "A" ? "bg-deck-a" : "bg-deck-b"}`}>{slot}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${live ? "bg-hot/15 text-hot" : "text-mute"}`}>{v.state}</span>
        {cue != null && <span className="ml-auto text-faint tnum">vocals {fmt(cue)}{t?.cue != null ? " · set" : ""}</span>}
      </header>
      <div className="mt-3 flex items-center gap-3">
        <Artwork track={t} className="w-12 h-12 shrink-0 [container-type:inline-size]" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{t ? t.title : "Nothing loaded"}</div>
          <div className="truncate text-sm text-mute">{t ? t.artist : "Waiting for the next song"}</div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tnum">{v.bpm ? v.bpm.toFixed(1) : "—"}</span>
        <span className="text-xs font-semibold text-mute">BPM</span>
        <span className="ml-auto text-xs text-mute">{t ? rate : ""}</span>
      </div>
      <MiniWave track={t} deck={v.deck} slot={slot} className="h-12 mt-2" />
      <div className="mt-1 flex justify-between text-xs text-faint tnum">
        <span>{fmt(v.pos)}</span>
        <span>{t ? "−" + fmt(t.dur - v.pos) : ""}</span>
      </div>
    </article>
  );
}
