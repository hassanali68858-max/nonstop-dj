"use client";
import { useEffect, useState } from "react";
import { getEngine } from "@/lib/engine";

export function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const off = getEngine()!.onToast((m) => {
      setMsg(m);
      clearTimeout(id);
      id = setTimeout(() => setMsg(null), 3600);
    });
    return () => { off(); clearTimeout(id); };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[100px] z-50 flex justify-center px-4">
      {msg && <div key={msg} className="pop-in rounded-full bg-play px-5 py-2.5 text-sm font-medium text-play-ink shadow-xl">{msg}</div>}
    </div>
  );
}
