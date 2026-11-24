# Nonstop · auto-DJ

Your songs, mixed like a DJ set. In the last 5–10 seconds of each song the next
song's intro beat comes in underneath, the old song fades out, and the next
song's first vocal line hits right as it ends. Tempo, beat grid, bars and the
vocal entry are all detected in the browser with the Web Audio API.

Five songs come pre-loaded from `public/songs/` (see `manifest.json`).

## Run it on your Mac

You need Node.js 20 or newer (`node -v` to check; get it from nodejs.org).

```bash
cd ~/Downloads/nonstop-dj
npm install
npm run dev
```

Open http://localhost:3000 and press Play.

## Publish it for testing (Vercel)

1. Push this folder to a **private** GitHub repo.
2. Go to vercel.com → Add New → Project → import the repo → Deploy.
   No settings are needed; Vercel detects Next.js.
3. **Turn on the password lock:** in Vercel, open Project → Settings →
   Environment Variables, add `SITE_PASSWORD` with a password of your choice,
   then redeploy. Visitors are asked for it (any username works). This
   also protects the song files.

> The pre-loaded songs are commercial tracks. Keep test deployments
> password-protected or private: a public link would let anyone stream
> or download them.

## Changing the pre-loaded songs

1. Put MP3s in `public/songs/` (192 kbps keeps them small).
2. Edit `public/songs/manifest.json`: one entry per song with `id`, `title`,
   `artist` and `src`. The `analysis` block is optional; without it the app
   analyzes each song in the browser on first load (about 2 seconds a song).

## Where things live

| Path | What it does |
|---|---|
| `src/lib/analysis.ts` | Tempo + beat grid, vocal entry, musical key (Camelot), song sections |
| `src/lib/engine.ts` | Two-deck mix engine: planning, beat-matching (incl. 3:2), transitions, transport |
| `src/components/NonstopApp.tsx` | App shell: sidebar, main view, floating player, mobile sheet, toasts |
| `src/components/Hero.tsx` | Now-playing header: artwork, status, title, BPM, vocals, key |
| `src/components/TrackPanel.tsx` | Big song overview (played, mix-out zone, sections) + beat-lock view |
| `src/components/DeckCard.tsx` / `MixCenter.tsx` | Deck A/B cards, crossfader, countdown, transition menu |
| `src/components/SetList.tsx` | The playlist ("Your set") with animated reordering |
| `src/components/PlayerBar.tsx` | Floating transport bar, Auto-Sync, settings popover, volume |
| `src/proxy.ts` | Optional password lock (`SITE_PASSWORD`) |

UI libraries: [Motion](https://motion.dev) for animation, [Radix UI](https://www.radix-ui.com)
for the menu, popover and slider, [NumberFlow](https://number-flow.barvian.me) for rolling
numbers, [Sonner](https://sonner.emilkowal.ski) for toasts, [Lucide](https://lucide.dev) icons.

Keys for the pre-loaded songs come from an offline analysis; keys for songs you
add are estimated in the browser and marked as estimates.

## How a transition works

- **Bass swap** (tempos within the max shift, default 8%; default blend 10 seconds): the ending song
  eases to the next song's tempo over 8 beats, the new intro fades in with
  its bass cut, the basslines swap halfway, the old song fades out.
- **Filter sweep**: the new song opens up from a low-pass filter.
- **3:2 beat lock**: songs whose tempos relate 2:3 (for example 90 and 135 BPM)
  are locked so three beats of one fit two of the other, then bass-swapped.
- **Echo out** (tempos too far apart): over the last ~10 seconds the new intro
  comes in with its kick building up while the old song is muffled; the old
  song's last beat is thrown into an echo, the new groove plays alone for two
  bars, then the vocals start.

The next song always plays at its own speed and pitch. Click any waveform to
move where a song's vocals start (it snaps to the nearest bar); double-click
to go back to the detected point.
