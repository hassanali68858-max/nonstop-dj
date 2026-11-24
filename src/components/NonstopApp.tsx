"use client";
import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";
import { useEngine } from "@/lib/hooks";
import { EmptyState } from "./EmptyState";
import { NowPlaying } from "./NowPlaying";
import { PlayerBar } from "./PlayerBar";
import { SetList } from "./SetList";
import { Settings } from "./Settings";
import { Toast } from "./Toast";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-deck-a to-deck-b text-white"><AudioLines size={18} /></div>
      <span className="text-lg font-extrabold tracking-tight">Nonstop</span>
    </div>
  );
}

export default function NonstopApp() {
  const e = useEngine();
  const [settings, setSettings] = useState(false);
  const [queue, setQueue] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    e.loadManifest("/songs/manifest.json");
    const over = (ev: DragEvent) => { ev.preventDefault(); setDrag(true); };
    const leave = (ev: DragEvent) => { if (!ev.relatedTarget) setDrag(false); };
    const drop = (ev: DragEvent) => {
      ev.preventDefault();
      setDrag(false);
      if (ev.dataTransfer?.files.length) e.addFiles(ev.dataTransfer.files);
    };
    const key = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (ev.code === "Space" && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(tag)) { ev.preventDefault(); e.toggle(); }
      if (ev.key === "Escape") { setSettings(false); setQueue(false); }
    };
    addEventListener("dragover", over); addEventListener("dragleave", leave); addEventListener("drop", drop); addEventListener("keydown", key);
    return () => { removeEventListener("dragover", over); removeEventListener("dragleave", leave); removeEventListener("drop", drop); removeEventListener("keydown", key); };
  }, [e]);

  const empty = e.booted && e.tracks.length === 0;
  return (
    <div className="grid h-dvh grid-rows-[minmax(0,1fr)_auto] bg-bg">
      <div className="grid min-h-0 gap-2 p-0 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-2 lg:pb-0">
        <aside className="hidden min-h-0 flex-col rounded-xl bg-surface lg:flex">
          <div className="p-5 pb-4"><Brand /></div>
          <SetList />
        </aside>
        <main className={`scroll-y relative min-h-0 bg-surface lg:rounded-xl ${drag ? "ring-2 ring-hot ring-inset" : ""}`}>
          <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/70 px-4 py-3 backdrop-blur-xl lg:hidden">
            <Brand />
            <button onClick={() => setQueue(true)} className="h-9 rounded-full bg-elev2 px-4 text-sm font-semibold">Your set · {e.tracks.length}</button>
          </div>
          {empty ? <EmptyState /> : <NowPlaying />}
        </main>
      </div>
      <PlayerBar onSettings={() => setSettings((s) => !s)} onQueue={() => setQueue(true)} />
      {settings && <Settings onClose={() => setSettings(false)} />}
      {queue && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setQueue(false)} />
          <div role="dialog" aria-label="Your set" className="sheet-in fixed inset-x-0 bottom-0 z-40 flex h-[80dvh] flex-col rounded-t-3xl bg-surface pt-3 pb-[env(safe-area-inset-bottom)] shadow-2xl lg:hidden">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-faint/50" />
            <SetList onClose={() => setQueue(false)} />
          </div>
        </>
      )}
      <Toast />
    </div>
  );
}
