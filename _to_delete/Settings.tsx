"use client";
import { X } from "lucide-react";
import type { Options } from "@/lib/engine";
import { useEngine } from "@/lib/hooks";

function Seg<T extends string | number>({ label, value, options, onChange, cols }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-mute">{label}</div>
      <div className="grid gap-1 rounded-xl bg-elev p-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0,1fr))` }} role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            role="radio"
            aria-checked={v === value}
            onClick={() => onChange(v)}
            className={`h-9 rounded-lg px-2 text-sm font-medium transition-colors ${v === value ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-mute hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const e = useEngine();
  const o = e.opt;
  const set = (p: Partial<Options>) => e.setOpt(p);
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40 lg:bg-transparent" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Mix settings"
        className="sheet-in lg:pop-in fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-elev2 p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl lg:inset-x-auto lg:bottom-[100px] lg:right-4 lg:w-[360px] lg:rounded-2xl lg:bg-surface lg:ring-1 lg:ring-line"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-faint/50 lg:hidden" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Mix settings</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-elev hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-5">
          <Seg label="Transition" cols={2} value={o.style} onChange={(v) => set({ style: v })} options={[["auto", "Auto"], ["swap", "Bass swap"], ["filter", "Filter sweep"], ["echo", "Echo out"]]} />
          <Seg label="Blend length" value={o.blend} onChange={(v) => set({ blend: v })} options={[[5, "5s"], [8, "8s"], [10, "10s"]]} />
          <Seg label="Next song enters at" value={o.enter} onChange={(v) => set({ enter: v })} options={[["vocals", "First vocals"], ["start", "Song start"]]} />
          <Seg label="Max tempo shift" value={o.shift} onChange={(v) => set({ shift: v })} options={[[0.04, "4%"], [0.06, "6%"], [0.08, "8%"]]} />
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Loop the set</span>
            <button
              role="switch"
              aria-checked={o.loop}
              onClick={() => set({ loop: !o.loop })}
              className={`relative h-7 w-12 rounded-full transition-colors ${o.loop ? "bg-hot" : "bg-elev"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${o.loop ? "left-6" : "left-1"}`} />
            </button>
          </label>
          <label className="lg:hidden">
            <div className="mb-2 text-xs font-semibold text-mute">Volume</div>
            <input type="range" min={0} max={1} step={0.01} value={o.vol} onChange={(ev) => set({ vol: +ev.target.value })} className="slim w-full" style={{ "--v": `${o.vol * 100}%` } as React.CSSProperties} />
          </label>
          <p className="text-xs text-faint">Auto beat-matches songs within your max tempo shift and uses an echo-out drop when tempos are too far apart. Click any waveform to move where a song&apos;s vocals start.</p>
        </div>
      </div>
    </>
  );
}
