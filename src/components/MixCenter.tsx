"use client";
import { useRef } from "react";
import { Shuffle } from "lucide-react";
import { useEngine, useFrame, useTicker } from "@/lib/hooks";

/** Self-moving crossfader plus the next-mix countdown. */
export function MixCenter() {
  const e = useEngine();
  useTicker(4);
  const knob = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (knob.current) knob.current.style.left = `${e.crossfade() * 100}%`;
    const m = e.mixInfo();
    if (bar.current) bar.current.style.width = `${(m?.progress ?? 0) * 100}%`;
  });
  const info = e.mixInfo();
  const canMix = e.playing && !e.paused && !!e.cur && !(e.plan && e.plan.armed);
  return (
    <div className="flex flex-col justify-center gap-4 rounded-2xl bg-elev/50 p-4">
      <div>
        <div className="flex justify-between text-[11px] font-bold text-faint px-1"><span>A</span><span>B</span></div>
        <div className="relative mx-3 mt-2 h-1.5 rounded-full bg-gradient-to-r from-deck-a to-deck-b">
          <div ref={knob} className="absolute top-1/2 h-9 w-7 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface ring-1 ring-line shadow-lg">
            <div className="absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 rounded bg-hot" />
          </div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold tnum">{info ? info.title : e.tracks.length ? "Ready when you are" : "Add songs to begin"}</div>
        <p className="mt-1 text-xs text-mute text-balance">{info ? info.detail : "Every song blends into the next, with its vocals landing as the last one ends."}</p>
        <div className="mt-3 h-1 rounded-full bg-elev2 overflow-hidden"><div ref={bar} className="h-full bg-hot rounded-full" /></div>
      </div>
      <button
        onClick={() => e.mixNow()}
        disabled={!canMix}
        className="mx-auto inline-flex h-10 items-center gap-2 rounded-full bg-elev2 px-4 text-sm font-semibold hover:bg-line disabled:opacity-40"
      >
        <Shuffle size={16} /> Mix now
      </button>
    </div>
  );
}
