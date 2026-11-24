"use client";
import { ArrowDownUp, ChevronDown, ChevronUp, Play, Plus, Sparkles, X } from "lucide-react";
import { fmt, MAX_TRACKS, type Track } from "@/lib/engine";
import { useEngine } from "@/lib/hooks";
import { Artwork } from "./Artwork";

export function AddButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const e = useEngine();
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 ${className}`}>
      {children}
      <input
        type="file"
        accept="audio/*,.mp3,.wav,.m4a"
        multiple
        hidden
        onChange={(ev) => {
          if (ev.target.files) e.addFiles(ev.target.files);
          ev.target.value = "";
        }}
      />
    </label>
  );
}

function Row({ t, i, onPick }: { t: Track; i: number; onPick?: () => void }) {
  const e = useEngine();
  const now = e.cur?.track === t;
  const next = !now && e.plan?.next === t;
  const ready = t.status === "ready";
  const cue = ready ? e.cueOf(t) : null;
  const n = e.tracks.length;
  return (
    <li
      className={`group grid grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-elev ${now ? "bg-elev" : ""}`}
      onDoubleClick={() => ready && e.mixInto(t)}
    >
      <div className="grid place-items-center text-sm text-mute tnum">
        {now ? (
          <span className={`eq flex h-3.5 items-end gap-[2px] ${e.paused ? "paused" : ""}`} aria-label="Now playing"><i className="h-full" /><i className="h-full" /><i className="h-full" /></span>
        ) : (
          <>
            <span className="group-hover:hidden">{i + 1}</span>
            <button className="hidden group-hover:grid place-items-center text-ink disabled:opacity-30" disabled={!ready} onClick={() => e.mixInto(t)} aria-label={`${e.playing ? "Mix into" : "Play"} ${t.title}`} title={e.playing ? "Mix into this song now" : "Play"}>
              <Play size={16} fill="currentColor" />
            </button>
          </>
        )}
      </div>
      {ready || t.status === "error" ? (
        <Artwork track={t} className="h-11 w-11" />
      ) : (
        <div className="shimmer h-11 w-11 rounded-md" />
      )}
      <div
        className="min-w-0"
        onClick={() => {
          if (ready && !now && window.matchMedia("(hover: none)").matches) { e.mixInto(t); onPick?.(); }
        }}
      >
        <div className={`truncate font-medium ${now ? "text-hot" : ""}`}>{t.title}</div>
        <div className="truncate text-sm text-mute">
          {t.status === "error" ? (
            <span className="text-hot">Couldn&apos;t read this file</span>
          ) : ready ? (
            <>
              {next && <span className="mr-1.5 rounded bg-hot/15 px-1.5 py-px text-[11px] font-semibold text-hot">Up next</span>}
              {t.artist}
              {cue != null && <> · vocals {fmt(cue)}{t.cue != null ? " (set)" : ""}</>}
            </>
          ) : (
            <span className="inline-block h-3 w-28 rounded shimmer align-middle" aria-label="Analyzing" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <div className="text-right text-xs text-mute tnum group-hover:hidden max-lg:hidden">
          {ready && <><div>{t.bpm.toFixed(1)} BPM</div><div className="text-faint">{fmt(t.dur)}</div></>}
        </div>
        <div className="hidden items-center group-hover:flex max-lg:flex">
          <button className="grid h-9 w-8 place-items-center rounded text-mute hover:text-ink disabled:opacity-25" disabled={i === 0} onClick={() => e.move(t, -1)} aria-label="Move up"><ChevronUp size={18} /></button>
          <button className="grid h-9 w-8 place-items-center rounded text-mute hover:text-ink disabled:opacity-25" disabled={i === n - 1} onClick={() => e.move(t, 1)} aria-label="Move down"><ChevronDown size={18} /></button>
          <button className="grid h-9 w-8 place-items-center rounded text-mute hover:text-hot" onClick={() => e.remove(t)} aria-label={`Remove ${t.title}`}><X size={18} /></button>
        </div>
      </div>
    </li>
  );
}

export function SetList({ onClose }: { onClose?: () => void }) {
  const e = useEngine();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-bold">Your set</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-mute tnum">{e.tracks.length} / {MAX_TRACKS}</span>
          {onClose && (
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-elev" aria-label="Close"><X size={18} /></button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 px-4">
        <AddButton className="h-9 rounded-full bg-elev2 px-3.5 text-sm font-semibold hover:bg-line">
          <Plus size={16} /> Add songs
        </AddButton>
        <button onClick={() => e.sortByTempo()} className="inline-flex h-9 items-center gap-2 rounded-full bg-elev2 px-3.5 text-sm font-semibold hover:bg-line">
          <ArrowDownUp size={15} /> Sort by tempo
        </button>
        <button onClick={() => e.addDemos()} className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-mute hover:text-ink">
          <Sparkles size={15} /> Demo beats
        </button>
      </div>
      <ol className="scroll-y mt-3 flex-1 px-2 pb-2">
        {e.tracks.map((t, i) => <Row key={t.id} t={t} i={i} onPick={onClose} />)}
        {!e.tracks.length && <li className="px-3 py-8 text-sm text-mute">No songs yet. Add up to 10, or drop them anywhere on the page.</li>}
      </ol>
      <p className="px-4 pb-4 pt-2 text-xs text-faint">{onClose ? "Tap a song to mix into it." : "Double-click a song to mix into it."} Your files never leave this device.</p>
    </div>
  );
}
