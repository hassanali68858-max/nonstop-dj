"use client";
import { AudioLines, Sparkles, Upload } from "lucide-react";
import { useEngine } from "@/lib/hooks";
import { AddButton } from "./SetList";

export function EmptyState() {
  const e = useEngine();
  return (
    <section className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-xl rounded-3xl border-2 border-dashed border-line p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-deck-a to-deck-b text-white shadow-lg">
          <AudioLines size={30} />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-balance lg:text-4xl">Drop your songs and the set mixes itself</h1>
        <p className="mx-auto mt-3 max-w-md text-mute text-balance">Up to 10 MP3, WAV or M4A files. Every song blends into the next, with its vocals landing right as the last one ends.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <AddButton className="h-12 rounded-full bg-play px-6 font-semibold text-play-ink hover:scale-[1.02] transition-transform">
            <Upload size={18} /> Add songs
          </AddButton>
          <button onClick={() => e.addDemos()} className="inline-flex h-12 items-center gap-2 rounded-full bg-elev2 px-6 font-semibold hover:bg-line">
            <Sparkles size={18} /> Try demo beats
          </button>
        </div>
        <p className="mt-6 text-xs text-faint">Analyzed in your browser. Nothing is uploaded.</p>
      </div>
    </section>
  );
}
