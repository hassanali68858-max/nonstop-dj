import { Music2 } from "lucide-react";
import type { Track } from "@/lib/engine";

/** Generated cover art: each song gets its own colour field with vinyl grooves. */
export function Artwork({ track, className = "", rounded = "rounded-md", letter = true }: { track: Track | null; className?: string; rounded?: string; letter?: boolean }) {
  if (!track)
    return (
      <div className={`grid place-items-center bg-elev2 text-faint ${rounded} ${className}`}>
        <Music2 className="w-1/3 h-1/3" />
      </div>
    );
  const h = track.hue;
  const style = {
    background: `radial-gradient(110% 110% at 18% 12%, hsl(${h} 92% 64% / .95) 0%, transparent 55%),
      radial-gradient(120% 120% at 92% 95%, hsl(${(h + 48) % 360} 88% 50%) 0%, transparent 62%),
      linear-gradient(140deg, hsl(${h} 55% 24%), hsl(${(h + 28) % 360} 65% 10%))`,
  };
  return (
    <div className={`relative overflow-hidden [container-type:inline-size] ${rounded} ${className}`} style={style} aria-hidden="true">
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{ background: "repeating-radial-gradient(circle at 70% 70%, #fff 0 1px, transparent 1px 7px)" }}
      />
      {letter && (
        <span className="absolute left-[9%] bottom-[5%] font-extrabold text-white/90 leading-none tracking-tight" style={{ fontSize: "clamp(10px, 38cqw, 120px)" }}>
          {track.title.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
