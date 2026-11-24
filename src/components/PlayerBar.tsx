"use client";
import { useRef } from "react";
import { ListMusic, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { fmt } from "@/lib/engine";
import { useEngine, useFrame, useTicker } from "@/lib/hooks";
import { Artwork } from "./Artwork";

function Progress() {
  const e = useEngine();
  const fill = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLSpanElement>(null);
  const rm = useRef<HTMLSpanElement>(null);
  useFrame(() => {
    const d = e.cur, t = d?.track;
    const pos = d && t ? Math.min(t.dur, Math.max(0, e.posAt(d, e.now()))) : 0;
    const dur = t?.dur || 1;
    if (fill.current) fill.current.style.width = `${(pos / dur) * 100}%`;
    if (el.current) el.current.textContent = fmt(pos);
    if (rm.current) rm.current.textContent = t ? "−" + fmt(dur - pos) : "0:00";
    const p = e.plan;
    if (zone.current) {
      if (p && d && p.from === d) {
        zone.current.style.display = "block";
        zone.current.style.left = `${(Math.max(0, p.zA) / dur) * 100}%`;
        zone.current.style.width = `${(Math.max(0, p.zB - Math.max(0, p.zA)) / dur) * 100}%`;
      } else zone.current.style.display = "none";
    }
  });
  const seek = (ev: React.MouseEvent<HTMLDivElement>) => {
    const t = e.cur?.track;
    if (!t) return;
    const r = ev.currentTarget.getBoundingClientRect();
    e.seek(((ev.clientX - r.left) / r.width) * t.dur);
  };
  return (
    <div className="flex w-full items-center gap-2 text-[11px] text-mute tnum">
      <span ref={el} className="w-9 text-right max-sm:hidden">0:00</span>
      <div className="group relative flex h-4 flex-1 cursor-pointer items-center" onClick={seek} aria-label="Seek" title="Click to jump">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-elev2 transition-[height] group-hover:h-1.5">
          <div ref={zone} className="absolute inset-y-0 bg-hot/45" title="Mix zone" />
          <div ref={fill} className="absolute inset-y-0 left-0 rounded-full bg-ink group-hover:bg-hot" />
        </div>
      </div>
      <span ref={rm} className="w-9 max-sm:hidden">0:00</span>
    </div>
  );
}

export function PlayerBar({ onSettings, onQueue }: { onSettings: () => void; onQueue: () => void }) {
  const e = useEngine();
  useTicker(2);
  const t = e.cur?.track ?? e.tracks.find((x) => x.status === "ready") ?? null;
  const info = e.mixInfo();
  const isPlaying = e.playing && !e.paused;
  const vol = e.opt.vol;
  return (
    <footer className="relative grid h-[84px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 pb-[env(safe-area-inset-bottom)] lg:h-[88px] lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)_minmax(0,1fr)] lg:px-4">
      <div className="absolute inset-x-3 top-0 lg:hidden"><Progress /></div>
      <div className="flex min-w-0 items-center gap-3">
        <Artwork track={t} className="h-12 w-12 shrink-0 lg:h-14 lg:w-14" letter={false} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{t ? t.title : "Nothing playing"}</div>
          <div className="truncate text-xs text-mute">{t ? (info && e.playing ? info.title : t.artist) : "Add songs to start"}</div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 lg:gap-4">
          <button onClick={() => e.prev()} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-ink max-lg:hidden" aria-label="Previous"><SkipBack size={20} fill="currentColor" /></button>
          <button onClick={() => e.toggle()} className="grid h-11 w-11 place-items-center rounded-full bg-play text-play-ink transition-transform hover:scale-105 active:scale-95" aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-px" />}
          </button>
          <button onClick={() => e.mixNow()} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-ink" aria-label="Mix into next song now" title="Mix into the next song now"><SkipForward size={20} fill="currentColor" /></button>
          <button onClick={onQueue} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-ink lg:hidden" aria-label="Your set"><ListMusic size={20} /></button>
          <button onClick={onSettings} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-ink lg:hidden" aria-label="Mix settings"><SlidersHorizontal size={19} /></button>
        </div>
        <div className="w-full max-lg:hidden"><Progress /></div>
      </div>
      <div className="flex items-center justify-end gap-2 max-lg:hidden">
        {info && e.playing && (
          <span className={`mr-1 rounded-full px-3 py-1 text-xs font-semibold tnum ${info.active ? "bg-hot/15 text-hot" : "bg-elev2 text-mute"}`}>{info.title}</span>
        )}
        <button onClick={onSettings} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-ink" aria-label="Mix settings" title="Mix settings"><SlidersHorizontal size={19} /></button>
        <button onClick={() => e.setOpt({ vol: vol > 0 ? 0 : 0.85 })} className="grid h-10 w-8 place-items-center text-mute hover:text-ink" aria-label={vol > 0 ? "Mute" : "Unmute"}>
          {vol > 0 ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <input
          type="range" min={0} max={1} step={0.01} value={vol}
          onChange={(ev) => e.setOpt({ vol: +ev.target.value })}
          className="slim w-28" aria-label="Volume"
          style={{ "--v": `${vol * 100}%` } as React.CSSProperties}
        />
      </div>
    </footer>
  );
}
