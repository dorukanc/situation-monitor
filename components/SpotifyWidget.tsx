"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import WidgetCard from "./WidgetCard";
import { sendTickerMessage } from "./StatusTicker";

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface SpotifyTrack {
  name: string;
  artists: string;
  album: string;
  albumArt: string | null;
  duration: number;
  progress: number;
  isPlaying: boolean;
  shuffleState: boolean;
  repeatState: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  uri: string;
}

type View = "player" | "playlists";

const STORAGE_KEY = "sm-spotify-tokens";
const POLL_INTERVAL = 3000;

export default function SpotifyWidget() {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [view, setView] = useState<View>("player");
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const lastTrackRef = useRef<string | null>(null);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTokens(parsed);
        setConnected(true);
      } catch {
        // Invalid tokens
      }
    }
    setHydrated(true);

    // Listen for postMessage from OAuth callback popup
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "spotify-tokens" && e.data.payload) {
        const data = e.data.payload as SpotifyTokens;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setTokens(data);
        setConnected(true);
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // Get valid access token (refresh if needed)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;

    // If token is still valid (with 60s buffer)
    if (tokens.expires_at > Date.now() + 60_000) {
      return tokens.access_token;
    }

    // Refresh
    try {
      const res = await fetch("/api/spotify/refresh", {
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
      const updated: SpotifyTokens = {
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

  // Fetch current playback
  const fetchPlayback = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("https://api.spotify.com/v1/me/player", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 204 || res.status === 202) {
        setTrack(null);
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          setConnected(false);
          setTokens(null);
          localStorage.removeItem(STORAGE_KEY);
        }
        return;
      }

      const data = await res.json();
      if (!data.item) {
        setTrack(null);
        return;
      }

      const newTrack: SpotifyTrack = {
        name: data.item.name,
        artists: data.item.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Unknown",
        album: data.item.album?.name ?? "",
        albumArt: data.item.album?.images?.[0]?.url ?? null,
        duration: data.item.duration_ms,
        progress: data.progress_ms ?? 0,
        isPlaying: data.is_playing,
        shuffleState: data.shuffle_state,
        repeatState: data.repeat_state,
      };
      setTrack(newTrack);
      setError(null);

      // Notify ticker on track change
      const trackId = `${newTrack.name}-${newTrack.artists}`;
      if (lastTrackRef.current !== trackId && newTrack.isPlaying) {
        lastTrackRef.current = trackId;
        sendTickerMessage(`NOW PLAYING: ${newTrack.name} — ${newTrack.artists}`);
      }
    } catch {
      setError("FETCH FAILED");
    }
  }, [getAccessToken]);

  // Fetch playlists
  const fetchPlaylists = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      setPlaylists(
        data.items.map((p: { id: string; name: string; tracks: { total: number }; uri: string }) => ({
          id: p.id,
          name: p.name,
          trackCount: p.tracks.total,
          uri: p.uri,
        }))
      );
    } catch {
      // ignore
    }
  }, [getAccessToken]);

  // Poll playback state
  useEffect(() => {
    if (!connected || !tokens) return;

    fetchPlayback();
    fetchPlaylists();

    pollRef.current = setInterval(fetchPlayback, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connected, tokens, fetchPlayback, fetchPlaylists]);

  // Playback controls
  const spotifyCommand = useCallback(
    async (endpoint: string, method: string = "PUT", body?: object) => {
      const token = await getAccessToken();
      if (!token) return;

      try {
        await fetch(`https://api.spotify.com/v1/me/player${endpoint}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        // Fetch updated state after a short delay
        setTimeout(fetchPlayback, 300);
      } catch {
        setError("CMD FAILED");
      }
    },
    [getAccessToken, fetchPlayback]
  );

  const togglePlay = () => {
    if (track?.isPlaying) {
      spotifyCommand("/pause", "PUT");
    } else {
      spotifyCommand("/play", "PUT");
    }
  };

  const nextTrack = () => spotifyCommand("/next", "POST");
  const prevTrack = () => spotifyCommand("/previous", "POST");
  const toggleShuffle = () => spotifyCommand(`/shuffle?state=${!track?.shuffleState}`, "PUT");

  const playPlaylist = (uri: string) => {
    spotifyCommand("/play", "PUT", { context_uri: uri });
    setView("player");
  };

  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("sm-spotify-connected");
    setTokens(null);
    setConnected(false);
    setTrack(null);
    setPlaylists([]);
    sendTickerMessage("SPOTIFY DISCONNECTED");
  };

  const connect = () => {
    window.open("/api/spotify/auth", "spotify-auth", "width=450,height=700");
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (!hydrated) {
    return (
      <WidgetCard title="Spotify">
        <div className="flex items-center justify-center h-full">
          <span className="text-[10px] text-muted uppercase tracking-wider">Loading...</span>
        </div>
      </WidgetCard>
    );
  }

  // Not connected state
  if (!connected) {
    return (
      <WidgetCard title="Spotify">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="text-muted text-[10px] uppercase tracking-wider text-center">
            No connection
          </div>
          <div className="w-12 h-12 border border-border rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-green" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>
          <button
            onClick={connect}
            className="px-4 py-1.5 border border-green/30 text-green text-[10px] uppercase tracking-wider hover:bg-green/10 transition-colors cursor-pointer"
          >
            Connect Spotify
          </button>
          <div className="text-muted/50 text-[8px] uppercase tracking-wider text-center leading-relaxed">
            Requires SPOTIFY_CLIENT_ID<br />
            & SPOTIFY_CLIENT_SECRET<br />
            in .env.local
          </div>
        </div>
      </WidgetCard>
    );
  }

  // Connected — Player view
  if (view === "player") {
    const progress = track ? (track.progress / track.duration) * 100 : 0;

    return (
      <WidgetCard title="Spotify">
        <div className="flex flex-col h-full">
          {/* Top bar: view toggle + disconnect */}
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
            <button
              onClick={disconnect}
              className="text-[8px] uppercase tracking-wider text-red/60 hover:text-red transition-colors cursor-pointer"
            >
              DC
            </button>
          </div>

          {!track ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] text-muted uppercase tracking-wider">
                {error ?? "No active playback"}
              </span>
            </div>
          ) : (
            <>
              {/* Album art + track info */}
              <div className="flex gap-3 mb-2 min-h-0">
                {track.albumArt ? (
                  <img
                    src={track.albumArt}
                    alt=""
                    className="w-14 h-14 flex-shrink-0 border border-border"
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
                  <div className="text-[9px] text-muted truncate" title={track.artists}>
                    {track.artists}
                  </div>
                  <div className="text-[8px] text-muted/50 truncate" title={track.album}>
                    {track.album}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
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
                    track.shuffleState ? "text-green" : "text-muted hover:text-foreground"
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
                  title={track.isPlaying ? "Pause" : "Play"}
                >
                  <span className="text-green text-xs font-bold">
                    {track.isPlaying ? "||" : "\u25B6"}
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
                  className={`text-[10px] cursor-pointer transition-colors ${
                    track.repeatState !== "off" ? "text-green" : "text-muted hover:text-foreground"
                  }`}
                  title="Repeat"
                  onClick={() => {
                    const next = track.repeatState === "off" ? "context" : track.repeatState === "context" ? "track" : "off";
                    spotifyCommand(`/repeat?state=${next}`, "PUT");
                  }}
                >
                  {track.repeatState === "track" ? "RP1" : "RPT"}
                </button>
              </div>

              {/* Status line */}
              <div className="mt-auto pt-1 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green pulse-dot" />
                <span className="text-[8px] text-green uppercase tracking-wider">
                  {track.isPlaying ? "Playing" : "Paused"}
                </span>
              </div>
            </>
          )}
        </div>
      </WidgetCard>
    );
  }

  // Playlists view
  return (
    <WidgetCard title="Spotify">
      <div className="flex flex-col h-full">
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
          <span className="text-[8px] text-muted uppercase tracking-wider">
            {playlists.length} lists
          </span>
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
                onClick={() => playPlaylist(pl.uri)}
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
