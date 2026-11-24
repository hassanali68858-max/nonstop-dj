import { Music2 } from "lucide-react";
import type { Track } from "@/lib/engine";

/** Generated cover: a deep two-tone field per song, its initial, optional key badge. */
export function Artwork({ track, className = "", rounded = "rounded-xl", letter = true, badge = false }: { track: Track | null; className?: string; rounded?: string; letter?: boolean; badge?: boolean }) {
  if (!track)
    return (
      <div className={`grid place-items-center bg-panel3 text-faint ${rounded} ${className}`}>
        <Music2 className="h-1/3 w-1/3" />
      </div>
    );
  const h = track.hue;
  return (
    <div
      className={`relative overflow-hidden [container-type:inline-size] ring-1 ring-white/10 ${rounded} ${className}`}
      style={{ background: `linear-gradient(155deg, hsl(${h} 62% 52%) 0%, hsl(${(h + 18) % 360} 55% 30%) 48%, hsl(${(h + 30) % 360} 45% 11%) 100%)` }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(255,255,255,.28),transparent_55%)]" />
      {letter && (
        <span className="absolute bottom-[7%] left-[10%] font-extrabold leading-none tracking-tighter text-white" style={{ fontSize: "clamp(10px, 34cqw, 110px)" }}>
          {track.title.slice(0, 1).toUpperCase()}
        </span>
      )}
      {badge && track.key && (
        <span className="mono absolute right-[6%] top-[6%] rounded-md bg-black/35 px-2 py-0.5 text-[clamp(9px,6cqw,13px)] font-semibold text-white/90 backdrop-blur">
          {track.key.camelot}
        </span>
      )}
    </div>
  );
}
