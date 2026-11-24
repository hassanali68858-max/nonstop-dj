"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getEngine, type Engine } from "./engine";

/** Re-renders whenever the engine announces a change. */
export function useEngine(): Engine {
  const e = getEngine()!;
  useSyncExternalStore(e.subscribe, e.getVersion, () => 0);
  return e;
}

/** Re-renders a few times a second, for clocks and countdowns. */
export function useTicker(hz = 4) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
}

/** Calls fn on every animation frame. */
export function useFrame(fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    let id = 0;
    const loop = () => {
      ref.current();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

export type Palette = { a: string; b: string; hot: string; ink: string; well: string; line: string; mute: string; faint: string; vox: string };
let pal: Palette | null = null;
let palAt = 0;
/** Current theme colours for canvas drawing (refreshed every second). */
export function palette(): Palette {
  const t = performance.now();
  if (!pal || t - palAt > 1000) {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    pal = { a: v("--deck-a"), b: v("--deck-b"), hot: v("--hot"), ink: v("--ink"), well: v("--well"), line: v("--line"), mute: v("--mute"), faint: v("--faint"), vox: v("--vox") };
    palAt = t;
  }
  return pal;
}

/** Sizes a canvas to its CSS box at device pixel ratio. */
export function fit(cv: HTMLCanvasElement): [number, number, number] {
  const r = window.devicePixelRatio || 1;
  const w = Math.round(cv.clientWidth * r), h = Math.round(cv.clientHeight * r);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  return [w, h, r];
}
