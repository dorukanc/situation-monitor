# Situation Monitor — Personal Dashboard

## What is this?
A personal "Situation Monitor" dashboard inspired by Pieter Levels' command-center style. Dark, terminal-aesthetic, grid-based single-page app for tracking productivity. Runs locally only (no deployment).

## Stack
- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** with `@theme inline`
- **TypeScript**
- **cobe** for 3D globe rendering
- No charting libraries — bars, gauges, sparklines are plain divs/SVG
- No state management library — localStorage + CustomEvent for cross-widget comms
- All data persisted in **localStorage** (no database)

## Design System
- Dark theme: `#0a0a0a` background, `#111111` surface, `#1a1a1a` borders
- Font: JetBrains Mono (monospace throughout)
- Green accents: `#00ff41` primary, `#00cc33` dim
- Amber `#ffaa00` for warnings, Red `#ff3333` for alerts
- Terminal aesthetic: uppercase labels, `tracking-[0.2em]`, pulsing status dots
- WidgetCard component wraps all widgets with consistent border/title/padding

## Layout
Dynamic grid managed by `DashboardGrid.tsx`. Layout order stored in localStorage (`sm-widget-layout`).
- Grid auto-calculates columns (2 or 3) and rows based on active widget count
- "Mini" widgets (Clock, Efficiency, Weather, Pomodoro) auto-group into 2x2 sub-grids
- Mobile (≤640px): single column, scrollable
- Default: Globe | GitHub | Tasks | HN | Spotify | mini-grid(Clock, Efficiency, Weather, Pomodoro)
- Customizable via WidgetPane (gear icon, bottom-right) — add/remove/reorder widgets with drag-and-drop

## Widget System
- `lib/widget-registry.ts` — Defines all available widgets with id, name, size, description
- `components/DashboardGrid.tsx` — Reads layout from localStorage, renders widgets dynamically
- `components/WidgetPane.tsx` — Slide-out configuration panel with drag-to-reorder + toggle

## Widgets (10 total, 9 active by default)

| Widget | File | Data Source |
|--------|------|-------------|
| Globe | `GlobeWidget.tsx` | GitHub API (commit pulse), world clocks (JS Date) |
| GitHub Commits | `GitHubActivity.tsx` | `/api/github` → GitHub Events API |
| Tasks | `TodoWidget.tsx` | localStorage (`sm-todos`), has built-in timer per task |
| HN News Feed | `HackerNewsWidget.tsx` | `/api/hackernews` → HN Firebase API |
| Spotify | `SpotifyWidget.tsx` | Spotify Web API (OAuth), playback controls + playlists |
| Clock | `ClockWidget.tsx` | JS Date, ticks every second |
| Efficiency Score | `EfficiencyWidget.tsx` | Combines pomodoro + commits + todos into 0-100 score |
| Weather | `WeatherWidget.tsx` | `/api/weather` → Open-Meteo (no API key needed) |
| Pomodoro | `PomodoroWidget.tsx` | localStorage (`sm-pomodoro-sessions`), 25/5 cycle |
| Status Ticker | `StatusTicker.tsx` | CustomEvent `ticker-message`, CSS scroll animation |

## API Routes
- `/api/github` — Proxies GitHub Events API. Uses `GITHUB_TOKEN` env var. Counts PushEvents per day (falls back to 1 per push for private repos since commits array is stripped).
- `/api/hackernews` — Fetches top 5 HN stories via Firebase API.
- `/api/weather` — Proxies Open-Meteo. Accepts `lat`/`lon` query params, defaults to Istanbul.
- `/api/spotify/auth` — Initiates Spotify OAuth flow (opens authorization popup).
- `/api/spotify/callback` — Handles OAuth callback, stores tokens in localStorage via inline script.
- `/api/spotify/refresh` — Refreshes expired Spotify access tokens.

## Key Files
- `lib/config.ts` — GitHub username (`dorukanc`), intervals, efficiency targets
- `lib/efficiency.ts` — Score calculation formula + helpers
- `hooks/useLocalStorage.ts` — SSR-safe localStorage hook with hydration flag
- `.env.local` — `GITHUB_TOKEN` (classic PAT with `repo` scope), `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

## localStorage Keys
- `sm-todos` — Task list with time tracking
- `sm-pomodoro-sessions` — Completed pomodoro sessions
- `sm-live-channels` — YouTube Live channel tabs
- `sm-github-today` — Cached today's commit count
- `sm-efficiency-history` — 7-day efficiency scores
- `sm-spotify-tokens` — Spotify OAuth tokens (access, refresh, expiry)
- `sm-widget-layout` — Ordered array of active widget IDs for dashboard grid

## Conventions
- All widgets are client components (`"use client"`)
- Cross-widget communication via `window.dispatchEvent(new CustomEvent("ticker-message", { detail }))`
- Hydration safety: widgets show placeholder until `hydrated`/`mounted` state is true
- No charting libraries: bars are percentage-height divs, gauges are SVG circles with strokeDashoffset
- GitHub API quirk: private repo PushEvents don't include `payload.commits`, so we count each push as 1

## Running
```
npm run dev    # localhost:3000
npm run build  # production build check
```
