"use client";
import { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDownUp, ChevronDown, ChevronUp, Lock, Music, Play, Plus, X } from "lucide-react";
import { fmt, MAX_TRACKS, type Track } from "@/lib/engine";
import { useEngine, useFrame } from "@/lib/hooks";
import { Artwork } from "./Artwork";

export function AddButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const e = useEngine();
  return (
    <label className={`inline-flex cursor-pointer items-center justify-center gap-2 ${className}`}>
      {children}
      <input type="file" accept="audio/*,.mp3,.wav,.m4a" multiple hidden onChange={(ev) => { if (ev.target.files) e.addFiles(ev.target.files); ev.target.value = ""; }} />
    </label>
  );
}

function RowProgress() {
  const e = useEngine();
  const ref = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const d = e.cur;
    if (ref.current && d) ref.current.style.width = `${Math.min(100, (Math.max(0, e.posAt(d, e.now())) / d.track.dur) * 100)}%`;
  });
  return <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full"><div ref={ref} className="h-full bg-hot" /></div>;
}

function Row({ t, i, onPick }: { t: Track; i: number; onPick?: () => void }) {
  const e = useEngine();
  const now = e.cur?.track === t;
  const next = !now && e.plan?.next === t;
  const ready = t.status === "ready";
  const n = e.tracks.length;
  const go = () => { if (ready && !now) { e.mixInto(t); onPick?.(); } };
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={`group relative grid grid-cols-[22px_52px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${now ? "border-line2 bg-panel2" : "border-transparent hover:bg-panel2/60"}`}
      onDoubleClick={go}
      onClick={() => { if (window.matchMedia("(hover: none)").matches) go(); }}
    >
      <div className="mono grid place-items-center text-[13px] text-faint">
        {now ? (
          <span className={`eq flex h-3.5 items-end gap-[2px] ${e.paused ? "paused" : ""}`} aria-label="Now playing"><i className="h-full" /><i className="h-full" /><i className="h-full" /></span>
        ) : (
          <>
            <span className="group-hover:hidden">{i + 1}</span>
            <button className="hidden place-items-center text-ink group-hover:grid disabled:opacity-30" disabled={!ready} onClick={(ev) => { ev.stopPropagation(); go(); }} aria-label={`${e.playing ? "Mix into" : "Play"} ${t.title}`} title={e.playing ? "Mix into this song now" : "Play"}>
              <Play size={14} fill="currentColor" />
            </button>
          </>
        )}
      </div>
      {ready || t.status === "error" ? <Artwork track={t} className="h-[52px] w-[52px]" rounded="rounded-[10px]" /> : <div className="shimmer h-[52px] w-[52px] rounded-[10px]" />}
      <div className="min-w-0">
        <div className={`truncate text-[15px] font-semibold tracking-tight ${now ? "text-hot" : ""}`}>{t.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-mute">
          {t.status === "error" ? <span className="text-hot">Couldn&apos;t read this file</span>
            : ready ? <>{next && <span className="mono shrink-0 rounded bg-deck-b/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-deck-b">Up next</span>}<span className="truncate">{t.artist}</span></>
            : <span className="inline-block h-3 w-24 rounded shimmer" aria-label="Analyzing" />}
        </div>
      </div>
      <div className="relative">
        <div className={`mono text-right text-[13px] ${ready ? "group-hover:invisible max-lg:hidden" : ""}`}>
          {ready && (
            <>
              <div className="flex items-center justify-end gap-1.5">
                {t.key && <span className="rounded bg-white/[.06] px-1.5 py-px text-[10px] font-semibold text-mute" title={t.key.name + (t.keyEstimated ? " (estimated)" : "")}>{t.key.camelot}</span>}
                <span className="text-ink/90">{t.bpm.toFixed(1)}</span>
              </div>
              <div className="mt-1 text-faint">{fmt(t.dur)}</div>
            </>
          )}
        </div>
        <div className="absolute inset-y-0 right-0 hidden items-center group-hover:flex max-lg:static max-lg:flex">
          <button className="grid h-8 w-7 place-items-center rounded text-mute hover:text-ink disabled:opacity-25" disabled={i === 0} onClick={(ev) => { ev.stopPropagation(); e.move(t, -1); }} aria-label="Move up"><ChevronUp size={17} /></button>
          <button className="grid h-8 w-7 place-items-center rounded text-mute hover:text-ink disabled:opacity-25" disabled={i === n - 1} onClick={(ev) => { ev.stopPropagation(); e.move(t, 1); }} aria-label="Move down"><ChevronDown size={17} /></button>
          <button className="grid h-8 w-7 place-items-center rounded text-mute hover:text-hot" onClick={(ev) => { ev.stopPropagation(); e.remove(t); }} aria-label={`Remove ${t.title}`}><X size={17} /></button>
        </div>
      </div>
      {now && <RowProgress />}
    </motion.li>
  );
}

export function SetList({ onClose }: { onClose?: () => void }) {
  const e = useEngine();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5">
        <h2 className="text-[17px] font-semibold tracking-tight">Your set</h2>
        <div className="flex items-center gap-2">
          <span className="mono rounded-md border border-line bg-white/[.03] px-2 py-0.5 text-[13px] text-mute">{e.tracks.length} / {MAX_TRACKS}</span>
          {onClose && <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-panel2" aria-label="Close"><X size={18} /></button>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 px-5">
        <AddButton className="h-10 rounded-xl border border-line2 bg-white/[.02] text-sm font-semibold transition-colors hover:bg-white/[.06]">
          <Plus size={16} className="text-deck-a" /> Add songs
        </AddButton>
        <button onClick={() => e.sortByTempo()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line2 bg-white/[.02] text-sm font-semibold transition-colors hover:bg-white/[.06]">
          <ArrowDownUp size={15} className="text-mute" /> Sort by tempo
        </button>
      </div>
      <button onClick={() => e.addDemos()} className="mx-5 mt-3 inline-flex items-center gap-2 self-start rounded-md py-1 text-xs font-semibold uppercase tracking-wider text-faint hover:text-mute">
        <Music size={14} /> Demo beats
      </button>
      <ol className="scroll-y mt-2 flex flex-1 flex-col gap-1 px-3 pb-3">
        <AnimatePresence initial={false}>
          {e.tracks.map((t, i) => <Row key={t.id} t={t} i={i} onPick={onClose} />)}
        </AnimatePresence>
        {!e.tracks.length && <li className="px-3 py-8 text-sm text-mute">No songs yet. Add up to 10, or drop them anywhere.</li>}
      </ol>
      <p className="mx-5 flex gap-2 border-t border-line py-4 text-xs leading-relaxed text-faint">
        <Lock size={14} className="mt-0.5 shrink-0 text-vox" />
        <span>{onClose ? "Tap" : "Double-click"} a song to mix into it. Audio analysis runs locally; your files never leave this device.</span>
      </p>
    </div>
  );
}
