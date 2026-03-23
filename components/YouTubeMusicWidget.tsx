"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import WidgetCard from "./WidgetCard";
import { sendTickerMessage } from "./StatusTicker";

/* ── YouTube IFrame API types ─────────────────────────────────── */

interface YTPlayerOptions {
  height?: string;
  width?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
  };
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  loadPlaylist(opts: { list: string; listType: string; index?: number }): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string; title: string; author: string };
  getPlayerState(): number;
  getPlaylistIndex(): number;
  setShuffle(shuffle: boolean): void;
  setLoop(loop: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT: {
      Player: new (id: string, opts: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        UNSTARTED: number;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

/* ── Load IFrame API once ─────────────────────────────────────── */

let ytApiPromise: Promise<void> | null = null;

function loadYTApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  if (window.YT?.Player) {
    ytApiPromise = Promise.resolve();
    return ytApiPromise;
  }

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });

  return ytApiPromise;
}

/* ── Types ────────────────────────────────────────────────────── */

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface TrackInfo {
  name: string;
  artist: string;
  videoId: string;
  thumbnail: string | null;
  duration: number; // ms
  progress: number; // ms
}

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
}

type View = "player" | "playlists";

const STORAGE_KEY = "sm-ytmusic-tokens";
const POLL_INTERVAL = 1000;
const PLAYER_EL_ID = "yt-music-player-el";

/* ── Component ────────────────────────────────────────────────── */

export default function YouTubeMusicWidget() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [view, setView] = useState<View>("player");
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [looped, setLooped] = useState(false);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval>>(null);
  const lastTrackRef = useRef<string | null>(null);
  const playerReadyRef = useRef(false);
  const volumeBeforeMuteRef = useRef(100);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // ── Load tokens from localStorage ──────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTokens(parsed);
        setConnected(true);
      } catch {
        // invalid
      }
    }
    setHydrated(true);

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "ytmusic-tokens" && e.data.payload) {
        const data = e.data.payload as Tokens;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setTokens(data);
        setConnected(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // ── Token refresh ──────────────────────────────────────────
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;
    if (tokens.expires_at > Date.now() + 60_000) return tokens.access_token;

    try {
      const res = await fetch("/api/ytmusic/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });

      if (!res.ok) {
        setConnected(false);
        setTokens(null);
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      const newTokens = await res.json();
      const updated: Tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newTokens.expires_at,
      };
      setTokens(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated.access_token;
    } catch {
      return null;
    }
  }, [tokens]);

  // ── Create YouTube player ──────────────────────────────────
  useEffect(() => {
    if (!connected) return;

    let destroyed = false;

    loadYTApi().then(() => {
      if (destroyed) return;
      // Ensure the container div exists
      if (!document.getElementById(PLAYER_EL_ID)) return;

      playerRef.current = new window.YT.Player(PLAYER_EL_ID, {
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
          },
          onStateChange: (e) => {
            const state = e.data;
            const playing = state === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);

            if (playing) {
              updateTrackInfo();
            }
          },
          onError: () => {
            setError("PLAYBACK ERROR");
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (progressRef.current) clearInterval(progressRef.current);
      try {
        playerRef.current?.destroy();
      } catch {
        // already destroyed
      }
      playerRef.current = null;
      playerReadyRef.current = false;
    };
  }, [connected]);

  // ── Update track info from player ──────────────────────────
  const updateTrackInfo = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    try {
      const data = player.getVideoData();
      if (!data?.video_id) return;

      const duration = player.getDuration() * 1000;
      const progress = player.getCurrentTime() * 1000;

      setTrack({
        name: data.title || "Unknown",
        artist: data.author || "Unknown",
        videoId: data.video_id,
        thumbnail: `https://i.ytimg.com/vi/${data.video_id}/mqdefault.jpg`,
        duration,
        progress,
      });
      setError(null);

      // Notify ticker on track change
      const trackId = `${data.video_id}`;
      if (lastTrackRef.current !== trackId) {
        lastTrackRef.current = trackId;
        sendTickerMessage(`NOW PLAYING: ${data.title} — ${data.author}`);
      }
    } catch {
      // player not ready
    }
  }, []);

  // ── Progress polling ───────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      progressRef.current = setInterval(updateTrackInfo, POLL_INTERVAL);
    } else {
      if (progressRef.current) clearInterval(progressRef.current);
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isPlaying, updateTrackInfo]);

  // ── Fetch playlists ────────────────────────────────────────
  const fetchPlaylists = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=25",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        if (res.status === 401) {
          setConnected(false);
          setTokens(null);
          localStorage.removeItem(STORAGE_KEY);
        }
        return;
      }

      const data = await res.json();
      setPlaylists(
        (data.items ?? []).map(
          (p: {
            id: string;
            snippet: { title: string };
            contentDetails: { itemCount: number };
          }) => ({
            id: p.id,
            name: p.snippet.title,
            trackCount: p.contentDetails.itemCount,
          })
        )
      );
    } catch {
      // ignore
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!connected || !tokens) return;
    fetchPlaylists();
  }, [connected, tokens, fetchPlaylists]);

  // ── Playback controls ──────────────────────────────────────
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const nextTrack = () => {
    playerRef.current?.nextVideo();
    setTimeout(updateTrackInfo, 500);
  };

  const prevTrack = () => {
    playerRef.current?.previousVideo();
    setTimeout(updateTrackInfo, 500);
  };

  const toggleShuffle = () => {
    const next = !shuffled;
    setShuffled(next);
    playerRef.current?.setShuffle(next);
  };

  const toggleLoop = () => {
    const next = !looped;
    setLooped(next);
    playerRef.current?.setLoop(next);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    setMuted(val === 0);
    playerRef.current?.setVolume(val);
    if (val > 0) playerRef.current?.unMute();
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (muted) {
      const restoreVol = volumeBeforeMuteRef.current || 100;
      player.unMute();
      player.setVolume(restoreVol);
      setVolume(restoreVol);
      setMuted(false);
    } else {
      volumeBeforeMuteRef.current = volume;
      player.mute();
      setMuted(true);
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current || !track || track.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTimeSec = (pct * track.duration) / 1000;
    player.seekTo(seekTimeSec, true);
    setTrack((prev) => prev ? { ...prev, progress: pct * prev.duration } : prev);
  };

  const handleSeekDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSeeking) return;
    seekTo(e);
  };

  const playPlaylist = (playlistId: string) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.loadPlaylist({ list: playlistId, listType: "playlist" });
    setView("player");
  };

  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTokens(null);
    setConnected(false);
    setTrack(null);
    setPlaylists([]);
    setIsPlaying(false);
    sendTickerMessage("YOUTUBE MUSIC DISCONNECTED");
  };

  const connect = () => {
    window.open("/api/ytmusic/auth", "ytmusic-auth", "width=500,height=700");
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Render: loading ────────────────────────────────────────
  if (!hydrated) {
    return (
      <WidgetCard title="YT Music">
        <div className="flex items-center justify-center h-full">
          <span className="text-[10px] text-muted uppercase tracking-wider">Loading...</span>
        </div>
      </WidgetCard>
    );
  }

  // ── Render: not connected ──────────────────────────────────
  if (!connected) {
    return (
      <WidgetCard title="YT Music">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="text-muted text-[10px] uppercase tracking-wider text-center">
            No connection
          </div>
          <div className="w-12 h-12 border border-border rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-red" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
          <button
            onClick={connect}
            className="px-4 py-1.5 border border-red/30 text-red text-[10px] uppercase tracking-wider hover:bg-red/10 transition-colors cursor-pointer"
          >
            Connect YouTube
          </button>
          <div className="text-muted/50 text-[8px] uppercase tracking-wider text-center leading-relaxed">
            Requires GOOGLE_CLIENT_ID<br />
            & GOOGLE_CLIENT_SECRET<br />
            in .env.local
          </div>
        </div>
      </WidgetCard>
    );
  }

  // ── Render: player view ────────────────────────────────────
  if (view === "player") {
    const progress = track && track.duration > 0 ? (track.progress / track.duration) * 100 : 0;

    return (
      <WidgetCard title="YT Music">
        <div className="flex flex-col h-full">
          {/* Hidden YouTube player element */}
          <div className="absolute overflow-hidden" style={{ width: 1, height: 1, opacity: 0 }}>
            <div id={PLAYER_EL_ID} />
          </div>

          {/* Top bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setView("player")}
                className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 text-green border border-green/30 bg-green/10 cursor-pointer"
              >
                Player
              </button>
              <button
                onClick={() => setView("playlists")}
                className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 text-muted border border-border hover:text-green hover:border-green/30 transition-colors cursor-pointer"
              >
                Playlists
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border transition-colors cursor-pointer ${
                  muted
                    ? "border-muted text-muted hover:border-foreground hover:text-foreground"
                    : "border-green/30 text-green"
                }`}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={disconnect}
                className="text-[8px] uppercase tracking-wider text-red/60 hover:text-red transition-colors cursor-pointer"
              >
                DC
              </button>
            </div>
          </div>

          {!track ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] text-muted uppercase tracking-wider">
                {error ?? "Select a playlist to play"}
              </span>
            </div>
          ) : (
            <>
              {/* Thumbnail + track info */}
              <div className="flex gap-3 mb-2 min-h-0">
                {track.thumbnail ? (
                  <img
                    src={track.thumbnail}
                    alt=""
                    className="w-14 h-14 flex-shrink-0 border border-border object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 flex-shrink-0 border border-border bg-background flex items-center justify-center">
                    <span className="text-muted text-[8px]">NO ART</span>
                  </div>
                )}
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="text-[11px] text-foreground font-medium truncate" title={track.name}>
                    {track.name}
                  </div>
                  <div className="text-[9px] text-muted truncate" title={track.artist}>
                    {track.artist}
                  </div>
                </div>
              </div>

              {/* Seekable progress bar */}
              <div className="mb-2">
                <div
                  ref={progressBarRef}
                  className="w-full h-2 bg-border rounded-full overflow-hidden cursor-pointer group"
                  onClick={seekTo}
                  onMouseDown={() => setIsSeeking(true)}
                  onMouseMove={handleSeekDrag}
                  onMouseUp={() => setIsSeeking(false)}
                  onMouseLeave={() => setIsSeeking(false)}
                  title="Click or drag to seek"
                >
                  <div
                    className="h-full bg-green rounded-full transition-all ease-linear group-hover:bg-green/80"
                    style={{ width: `${progress}%`, transitionDuration: isSeeking ? "0ms" : "1000ms" }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[8px] text-muted">{formatTime(track.progress)}</span>
                  <span className="text-[8px] text-muted">{formatTime(track.duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={toggleShuffle}
                  className={`text-[10px] cursor-pointer transition-colors ${
                    shuffled ? "text-green" : "text-muted hover:text-foreground"
                  }`}
                  title="Shuffle"
                >
                  SHF
                </button>
                <button
                  onClick={prevTrack}
                  className="text-foreground hover:text-green text-sm cursor-pointer transition-colors"
                  title="Previous"
                >
                  {"<<"}
                </button>
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 border border-green/50 flex items-center justify-center hover:bg-green/10 cursor-pointer transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  <span className="text-green text-xs font-bold">
                    {isPlaying ? "||" : "\u25B6"}
                  </span>
                </button>
                <button
                  onClick={nextTrack}
                  className="text-foreground hover:text-green text-sm cursor-pointer transition-colors"
                  title="Next"
                >
                  {">>"}
                </button>
                <button
                  onClick={toggleLoop}
                  className={`text-[10px] cursor-pointer transition-colors ${
                    looped ? "text-green" : "text-muted hover:text-foreground"
                  }`}
                  title="Loop"
                >
                  RPT
                </button>
              </div>

              {/* Volume slider */}
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={toggleMute}
                  className={`text-[8px] uppercase tracking-wider cursor-pointer transition-colors flex-shrink-0 ${
                    muted ? "text-muted" : "text-green"
                  }`}
                  title={muted ? "Unmute" : "Mute"}
                >
                  VOL
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="flex-1 h-1 accent-green cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-green) ${muted ? 0 : volume}%, #1a1a1a ${muted ? 0 : volume}%)`,
                  }}
                />
                <span className="text-[8px] text-muted w-6 text-right flex-shrink-0">
                  {muted ? 0 : volume}
                </span>
              </div>

              {/* Status line */}
              <div className="mt-auto pt-1 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green pulse-dot" />
                <span className="text-[8px] text-green uppercase tracking-wider">
                  {isPlaying ? "Playing" : "Paused"}
                </span>
              </div>
            </>
          )}
        </div>
      </WidgetCard>
    );
  }

  // ── Render: playlists view ─────────────────────────────────
  return (
    <WidgetCard title="YT Music">
      <div className="flex flex-col h-full">
        {/* Hidden YouTube player element */}
        <div className="absolute overflow-hidden" style={{ width: 1, height: 1, opacity: 0 }}>
          <div id={PLAYER_EL_ID} />
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            <button
              onClick={() => setView("player")}
              className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 text-muted border border-border hover:text-green hover:border-green/30 transition-colors cursor-pointer"
            >
              Player
            </button>
            <button
              onClick={() => setView("playlists")}
              className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 text-green border border-green/30 bg-green/10 cursor-pointer"
            >
              Playlists
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border transition-colors cursor-pointer ${
                muted
                  ? "border-muted text-muted hover:border-foreground hover:text-foreground"
                  : "border-green/30 text-green"
              }`}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <span className="text-[8px] text-muted uppercase tracking-wider">
              {playlists.length} lists
            </span>
          </div>
        </div>

        {/* Playlist list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
          {playlists.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-[10px] text-muted uppercase tracking-wider">No playlists</span>
            </div>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => playPlaylist(pl.id)}
                className="w-full text-left px-2 py-1.5 hover:bg-green/5 border border-transparent hover:border-green/20 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-foreground truncate group-hover:text-green transition-colors flex-1 mr-2">
                    {pl.name}
                  </span>
                  <span className="text-[8px] text-muted flex-shrink-0">
                    {pl.trackCount} trk
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
