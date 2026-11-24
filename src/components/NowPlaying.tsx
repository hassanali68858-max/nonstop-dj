"use client";
import { fmt } from "@/lib/engine";
import { useEngine } from "@/lib/hooks";
import { Artwork } from "./Artwork";
import { BeatView } from "./BeatView";
import { DeckCard } from "./DeckCard";
import { MixCenter } from "./MixCenter";

export function NowPlaying() {
  const e = useEngine();
  const t = e.cur?.track ?? e.tracks.find((x) => x.status === "ready") ?? null;
  const cue = t ? e.cueOf(t) : null;
  const hue = t?.hue ?? 220;
  return (
    <section className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] transition-[background] duration-1000"
        style={{ background: `linear-gradient(180deg, hsl(${hue} 70% 45% / .55) 0%, hsl(${hue} 60% 30% / .18) 55%, transparent 100%)` }}
      />
      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pb-10 pt-6 lg:px-8 lg:pt-10">
        <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
          <Artwork track={t} className="h-52 w-52 shrink-0 shadow-2xl shadow-black/50 sm:h-48 sm:w-48 lg:h-56 lg:w-56" rounded="rounded-xl" />
          <div className="min-w-0 pb-1">
            <p className="text-sm font-semibold text-ink/80">{e.playing ? (e.paused ? "Paused" : "Now playing") : t ? "Ready to play" : "Getting your set ready"}</p>
            <h1 className="mt-1 line-clamp-2 text-4xl font-extrabold leading-[1.05] tracking-tight text-balance lg:text-6xl">{t ? t.title : "Nonstop"}</h1>
            {t && (
              <p className="mt-3 text-sm text-ink/75">
                <span className="font-semibold text-ink">{t.artist}</span>
                <span className="tnum"> · {t.bpm.toFixed(1)} BPM · {fmt(t.dur)}{cue != null ? ` · vocals at ${fmt(cue)}` : ""}</span>
              </p>
            )}
          </div>
        </header>
        <BeatView />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px_minmax(0,1fr)]">
          <DeckCard slot="A" />
          <MixCenter />
          <DeckCard slot="B" />
        </div>
      </div>
    </section>
  );
}
