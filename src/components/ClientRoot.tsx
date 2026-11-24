"use client";
import dynamic from "next/dynamic";

// The mixer runs entirely on Web Audio, so it only renders in the browser.
const NonstopApp = dynamic(() => import("./NonstopApp"), {
  ssr: false,
  loading: () => <div className="h-dvh grid place-items-center text-mute">Loading Nonstop…</div>,
});

export default function ClientRoot() {
  return <NonstopApp />;
}
