"use client";
import { useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeftRight, Check, ChevronDown, Zap } from "lucide-react";
import { STYLE_NAMES, type Options } from "@/lib/engine";
import { useEngine, useFrame, useTicker } from "@/lib/hooks";
import { Countdown } from "./Countdown";

function Radio<T extends string | number>({ label, value, items, onPick }: { label: string; value: T; items: [T, string][]; onPick: (v: T) => void }) {
  return (
    <>
      <DropdownMenu.Label className="mono px-2.5 pb-1 pt-2 text-[10px] uppercase tracking-wider text-faint">{label}</DropdownMenu.Label>
      <DropdownMenu.RadioGroup value={String(value)} onValueChange={(v) => onPick(items.find(([k]) => String(k) === v)![0])}>
        {items.map(([k, l]) => (
          <DropdownMenu.RadioItem key={String(k)} value={String(k)} className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-white/[.07]">
            <span className="w-4">{String(k) === String(value) && <Check size={14} className="text-deck-a" />}</span>{l}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  );
}

export function TransitionMenu() {
  const e = useEngine();
  const o = e.opt, plan = e.plan;
  const shown = plan ? STYLE_NAMES[plan.style] : o.style === "auto" ? "Auto" : STYLE_NAMES[o.style];
  const set = (p: Partial<Options>) => e.setOpt(p);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line2 bg-white/[.03] px-3.5 text-sm font-medium outline-none transition-colors hover:bg-white/[.07] data-[state=open]:bg-white/[.08]">
        <Zap size={14} className="text-amber" fill="currentColor" /> {shown} • {o.blend}s <ChevronDown size={15} className="text-mute" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={8} align="center" className="z-50 w-56 rounded-2xl border border-line2 bg-panel2/95 p-1.5 shadow-2xl backdrop-blur-xl data-[state=open]:animate-pop">
          <Radio label="Transition" value={o.style} onPick={(v) => set({ style: v })} items={[["auto", "Auto (best fit)"], ["swap", "Bass swap"], ["filter", "Filter sweep"], ["echo", "Echo out"]]} />
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <Radio label="Blend length" value={o.blend} onPick={(v) => set({ blend: v })} items={[[5, "5 seconds"], [8, "8 seconds"], [10, "10 seconds"]]} />
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <Radio label="Next song enters at" value={o.enter} onPick={(v) => set({ enter: v })} items={[["vocals", "First vocals"], ["start", "Song start"]]} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MixCenter() {
  const e = useEngine();
  useTicker(4);
  const knob = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (knob.current) knob.current.style.left = `${e.crossfade() * 100}%`;
    if (bar.current) bar.current.style.transform = `scaleX(${e.mixInfo()?.progress ?? 0})`;
  });
  const info = e.mixInfo();
  const canMix = e.playing && !e.paused && !!e.cur && !(e.plan && e.plan.armed);
  return (
    <div className="card flex flex-col rounded-[24px] p-5">
      <div className="mono flex items-center justify-between text-xs">
        <span className="font-bold text-deck-a">A</span>
        <span className="tracking-[0.2em] text-faint">CROSSFADER</span>
        <span className="font-bold text-deck-b">B</span>
      </div>
      <div className="relative mx-2 mt-4">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-deck-a via-[#7d6bb0] to-deck-b" />
        <div className="mt-2 flex justify-between px-[2px]">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={`w-px bg-line2 ${i === 2 ? "h-2.5" : "h-1.5"}`} />)}</div>
        <div ref={knob} className="absolute top-[3px] h-10 w-7 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-gradient-to-b from-[#2a3242] to-[#161b25] shadow-[0_6px_16px_rgba(0,0,0,.5)]" style={{ transition: "left 60ms linear" }}>
          <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/40" />
        </div>
      </div>
      <div className="mt-6 text-center">
        <div className="mono text-[26px] font-semibold tracking-tight">
          {info && e.playing ? (
            info.active ? <span className="text-hot">Mixing · {Math.round(info.progress * 100)}%</span>
              : info.left > 0 && e.plan ? <>Next mix in <Countdown secs={info.left} className="text-deck-b" /></> : <span>{info.title}</span>
          ) : <span className="text-mute">{e.tracks.length ? "Ready" : "Add songs"}</span>}
        </div>
        <div className="mt-4 flex justify-center"><TransitionMenu /></div>
        <p className="mx-auto mt-3 max-w-[30ch] text-[13px] leading-snug text-faint">{info ? info.detail : "Each song blends into the next, its vocals landing as the last one ends."}</p>
      </div>
      <div className="mt-auto pt-4">
        <div className="mb-4 h-px overflow-hidden bg-line"><div ref={bar} className="h-full origin-left bg-hot" /></div>
        <button onClick={() => e.mixNow()} disabled={!canMix}
          className="mx-auto flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-black shadow-lg transition-[transform,opacity] hover:scale-[1.03] active:scale-[.98] disabled:opacity-40 disabled:hover:scale-100">
          <ArrowLeftRight size={17} /> Mix now
        </button>
      </div>
    </div>
  );
}
