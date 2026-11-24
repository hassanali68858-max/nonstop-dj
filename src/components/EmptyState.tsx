"use client";
import { motion } from "motion/react";
import { AudioLines, Sparkles, Upload } from "lucide-react";
import { useEngine } from "@/lib/hooks";
import { AddButton } from "./SetList";

export function EmptyState() {
  const e = useEngine();
  return (
    <section className="grid min-h-[70vh] place-items-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card w-full max-w-xl rounded-[28px] border-dashed p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-deck-a to-deck-b text-white shadow-lg"><AudioLines size={30} /></div>
        <h1 className="mt-6 text-4xl font-bold tracking-[-0.03em] text-balance">Drop your songs and the set mixes itself</h1>
        <p className="mx-auto mt-3 max-w-md text-mute text-balance">Up to 10 MP3, WAV or M4A files. Each song blends into the next with its vocals landing as the last one ends.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <AddButton className="h-12 rounded-xl bg-white px-6 font-semibold text-black transition-transform hover:scale-[1.03]"><Upload size={18} /> Add songs</AddButton>
          <button onClick={() => e.addDemos()} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line2 px-6 font-semibold hover:bg-white/[.05]"><Sparkles size={18} /> Try demo beats</button>
        </div>
        <p className="mono mt-6 text-xs text-faint">Analyzed in your browser · nothing is uploaded</p>
      </motion.div>
    </section>
  );
}
