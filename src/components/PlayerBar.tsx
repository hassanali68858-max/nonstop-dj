"use client";
import { useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { ListMusic, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { motion } from "motion/react";
import { fmt, type Options } from "@/lib/engine";
import { useEngine, useFrame, useTicker } from "@/lib/hooks";
import { Artwork } from "./Artwork";
import { Countdown } from "./Countdown";

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
    <div className="mono flex w-full items-center gap-3 text-xs">
      <span ref={el} className="w-10 text-right text-mute max-sm:hidden">0:00</span>
      <div className="group relative flex h-4 flex-1 cursor-pointer items-center" onClick={seek} aria-label="Seek" title="Click to jump">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10 transition-[height] group-hover:h-1.5">
          <div ref={zone} className="absolute inset-y-0 bg-deck-b/50" />
          <div ref={fill} className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-deck-a to-[#6ea8ff]" />
        </div>
      </div>
      <span ref={rm} className="w-11 text-hot max-sm:hidden">0:00</span>
    </div>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange, cols }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div>
      <div className="mono mb-2 text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="grid gap-1 rounded-xl border border-line bg-black/25 p-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0,1fr))` }} role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={String(v)} role="radio" aria-checked={v === value} onClick={() => onChange(v)}
            className={`relative h-8 rounded-lg px-2 text-[13px] font-medium transition-colors ${v === value ? "text-ink" : "text-mute hover:text-ink"}`}>
            {v === value && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-lg bg-panel3 ring-1 ring-line2" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const e = useEngine();
  const o = e.opt;
  const set = (p: Partial<Options>) => e.setOpt(p);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">Mix settings</h2>
      <Seg label="Transition" cols={2} value={o.style} onChange={(v) => set({ style: v })} options={[["auto", "Auto"], ["swap", "Bass swap"], ["filter", "Filter sweep"], ["echo", "Echo out"]]} />
      <Seg label="Blend length" value={o.blend} onChange={(v) => set({ blend: v })} options={[[5, "5s"], [8, "8s"], [10, "10s"]]} />
      <Seg label="Next song enters at" value={o.enter} onChange={(v) => set({ enter: v })} options={[["vocals", "First vocals"], ["start", "Song start"]]} />
      <Seg label="Max tempo shift" value={o.shift} onChange={(v) => set({ shift: v })} options={[[0.04, "4%"], [0.06, "6%"], [0.08, "8%"]]} />
      {[["sync", "Auto-Sync (beat-match)"], ["loop", "Loop the set"]].map(([k, l]) => {
        const on = o[k as "sync" | "loop"];
        return (
          <button key={k} role="switch" aria-checked={on} onClick={() => set({ [k]: !on } as Partial<Options>)} className="flex items-center justify-between text-sm">
            <span>{l}</span>
            <span className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-deck-a" : "bg-panel3"}`}>
              <motion.span layout className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ${on ? "right-1" : "left-1"}`} transition={{ type: "spring", stiffness: 600, damping: 35 }} />
            </span>
          </button>
        );
      })}
      <p className="text-xs leading-relaxed text-faint">Click a waveform on a deck to move where that song&apos;s vocals start; double-click to go back to auto.</p>
    </div>
  );
}

export function PlayerBar({ onQueue }: { onQueue: () => void }) {
  const e = useEngine();
  useTicker(2);
  const t = e.cur?.track ?? e.tracks.find((x) => x.status === "ready") ?? null;
  const info = e.mixInfo();
  const isPlaying = e.playing && !e.paused;
  const vol = e.opt.vol;
  return (
    <div className="glass card relative grid h-[84px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[22px] px-4 shadow-[0_20px_60px_rgba(0,0,0,.55)] lg:h-[92px] lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)_minmax(0,1fr)] lg:px-5">
      <div className="absolute inset-x-5 top-1 lg:hidden"><Progress /></div>
      <div className="flex min-w-0 items-center gap-3.5">
        <Artwork track={t} className="h-12 w-12 shrink-0 lg:h-14 lg:w-14" rounded="rounded-xl" />
        <div className="min-w-0">
          <div className="truncate font-semibold tracking-tight">{t ? t.title : "Nothing playing"}</div>
          <div className="mono truncate text-[13px] text-mute">
            {info && e.playing ? (info.active ? <span className="text-hot">Mixing · {Math.round(info.progress * 100)}%</span> : e.plan ? <><span className="max-sm:hidden">Next mix in </span><span className="sm:hidden">Mix in </span><Countdown secs={info.left} /></> : info.title) : t ? t.artist : "Add songs to start"}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-3 lg:gap-6">
          <button onClick={() => e.prev()} className="grid h-10 w-10 place-items-center rounded-full text-mute transition-colors hover:text-ink max-lg:hidden" aria-label="Previous"><SkipBack size={20} fill="currentColor" /></button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => e.toggle()} className="grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-lg lg:h-[54px] lg:w-[54px]" aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="translate-x-[1px]" />}
          </motion.button>
          <button onClick={() => e.mixNow()} className="grid h-10 w-10 place-items-center rounded-full text-mute transition-colors hover:text-ink" aria-label="Mix into next song now" title="Mix into the next song now"><SkipForward size={20} fill="currentColor" /></button>
          <button onClick={onQueue} className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-ink lg:hidden" aria-label="Your set"><ListMusic size={20} /></button>
        </div>
        <div className="w-full max-lg:hidden"><Progress /></div>
      </div>
      <div className="flex items-center justify-end gap-1 max-lg:hidden">
        <button onClick={() => e.setOpt({ sync: !e.opt.sync })} className={`mono mr-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/[.06] ${e.opt.sync ? "text-ink/90" : "text-faint"}`} title="Beat-match songs when their tempos allow">
          Auto-Sync <span className={e.opt.sync ? "text-vox" : "text-faint"}>{e.opt.sync ? "ON" : "OFF"}</span>
        </button>
        <SettingsButton />
        <button onClick={() => e.setOpt({ vol: vol > 0 ? 0 : 0.85 })} className="grid h-10 w-9 place-items-center text-mute hover:text-ink" aria-label={vol > 0 ? "Mute" : "Unmute"}>
          {vol > 0 ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <Slider.Root className="relative flex h-5 w-28 touch-none select-none items-center" value={[vol]} max={1} step={0.01} onValueChange={([v]) => e.setOpt({ vol: v })} aria-label="Volume">
          <Slider.Track className="relative h-1 grow overflow-hidden rounded-full bg-white/10"><Slider.Range className="absolute h-full rounded-full bg-white" /></Slider.Track>
          <Slider.Thumb className="block h-3.5 w-3.5 rounded-full bg-white shadow outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-deck-a" />
        </Slider.Root>
      </div>
    </div>
  );
}

export function SettingsButton({ className = "" }: { className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger className={`grid h-10 w-10 place-items-center rounded-full text-mute outline-none transition-colors hover:text-ink data-[state=open]:text-ink ${className}`} aria-label="Mix settings" title="Mix settings">
        <SlidersHorizontal size={19} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={14} collisionPadding={12} className="z-50 w-[340px] rounded-2xl border border-line2 bg-panel2/95 p-5 shadow-2xl backdrop-blur-xl outline-none data-[state=open]:animate-pop">
          <SettingsPanel />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
