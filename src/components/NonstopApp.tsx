"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Toaster, toast } from "sonner";
import { AudioLines } from "lucide-react";
import { getEngine } from "@/lib/engine";
import { useEngine } from "@/lib/hooks";
import { DeckCard } from "./DeckCard";
import { EmptyState } from "./EmptyState";
import { Hero } from "./Hero";
import { MixCenter } from "./MixCenter";
import { PlayerBar, SettingsButton } from "./PlayerBar";
import { SetList } from "./SetList";
import { TrackPanel } from "./TrackPanel";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-deck-a to-deck-b text-white shadow-lg"><AudioLines size={17} /></div>
      <span className="text-[17px] font-bold tracking-tight">Nonstop</span>
    </div>
  );
}

export default function NonstopApp() {
  const e = useEngine();
  const [queue, setQueue] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    e.loadManifest("/songs/manifest.json");
    const offToast = getEngine()!.onToast((m) => toast(m));
    const over = (ev: DragEvent) => { ev.preventDefault(); setDrag(true); };
    const leave = (ev: DragEvent) => { if (!ev.relatedTarget) setDrag(false); };
    const drop = (ev: DragEvent) => { ev.preventDefault(); setDrag(false); if (ev.dataTransfer?.files.length) e.addFiles(ev.dataTransfer.files); };
    const key = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (ev.code === "Space" && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(tag) && !(ev.target as HTMLElement).closest("[role=menu],[role=dialog]")) { ev.preventDefault(); e.toggle(); }
      if (ev.key === "Escape") setQueue(false);
    };
    addEventListener("dragover", over); addEventListener("dragleave", leave); addEventListener("drop", drop); addEventListener("keydown", key);
    return () => { offToast(); removeEventListener("dragover", over); removeEventListener("dragleave", leave); removeEventListener("drop", drop); removeEventListener("keydown", key); };
  }, [e]);

  const empty = e.booted && e.tracks.length === 0;
  return (
    <div className="grid h-dvh lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r border-line bg-panel/60 pt-6 lg:flex">
        <div className="mb-6 px-5"><Brand /></div>
        <SetList />
      </aside>
      <main className={`scroll-y relative min-h-0 ${drag ? "ring-2 ring-inset ring-deck-a" : ""}`}>
        <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <SettingsButton />
            <button onClick={() => setQueue(true)} className="mono h-9 rounded-full border border-line2 px-3.5 text-[13px]">Set · {e.tracks.length}</button>
          </div>
        </div>
        {empty ? <EmptyState /> : (
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pb-36 pt-8 lg:gap-8 lg:px-10 lg:pt-12">
            <Hero />
            <TrackPanel />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-5">
              <DeckCard slot="A" />
              <div className="md:col-span-2 md:order-last xl:order-none xl:col-span-1"><MixCenter /></div>
              <DeckCard slot="B" />
            </div>
          </div>
        )}
        <div className="pointer-events-none fixed inset-x-2 bottom-2 z-30 pb-[env(safe-area-inset-bottom)] lg:left-[356px] lg:right-6 lg:bottom-5">
          <div className="pointer-events-auto relative mx-auto max-w-[1280px]"><PlayerBar onQueue={() => setQueue(true)} /></div>
        </div>
      </main>
      <AnimatePresence>
        {queue && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setQueue(false)} />
            <motion.div key="sh" role="dialog" aria-label="Your set" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 120) setQueue(false); }}
              className="fixed inset-x-0 bottom-0 z-50 flex h-[82dvh] flex-col rounded-t-[28px] border-t border-line2 bg-panel pb-[env(safe-area-inset-bottom)] pt-3 lg:hidden">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <SetList onClose={() => setQueue(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Toaster theme="dark" position="bottom-center" offset={120} toastOptions={{ className: "!rounded-xl !border-line2 !bg-panel2 !text-ink" }} />
    </div>
  );
}
