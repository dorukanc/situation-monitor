"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import { useLocalStorage } from "@/hooks/useLocalStorage";

/* ── Types ────────────────────────────────────────────────────── */

interface Streamer {
  slug: string;
  label: string;
}

interface VodEntry {
  uuid: string;
  title: string;
  thumbnail: string | null;
  createdAt: string;
  duration: string;
}

interface PlayingVod {
  uuid: string;
  title: string;
  streamer: string;
  hlsUrl: string;
}

interface PlayingLive {
  slug: string;
  title: string;
  hlsUrl: string;
}

interface LiveErrorData {
  details?: string;
  fatal?: boolean;
  response?: {
    code?: number;
    text?: string;
  };
}

interface ChannelResolveResult {
  vods: {
    uuid: string;
    title: string;
    thumbnail: string | null;
    createdAt: string;
    duration: number;
  }[];
  playbackUrl: string | null;
  isLive: boolean;
  title: string;
}

type View = "streamers" | "vods" | "player";
type PlayerMode = "live" | "vod";

/* ── Helpers ──────────────────────────────────────────────────── */

function parseKickUrl(url: string): { username: string; videoId: string } | null {
  const match = url.match(/kick\.com\/([a-zA-Z0-9_-]+)\/videos\/([a-zA-Z0-9_-]+)/);
  if (match) return { username: match[1], videoId: match[2] };
  return null;
}

function parseKickChannelUrl(url: string): { username: string } | null {
  const match = url.match(/kick\.com\/([a-zA-Z0-9_-]+)\/?$/);
  if (match) return { username: match[1] };
  return null;
}

function getProxiedLiveUrl(url: string): string {
  return `/api/kick-live?url=${encodeURIComponent(url)}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Fetch channel VODs via popup (uses browser's Cloudflare cookies) */
function resolveChannelViaPopup(slug: string): Promise<ChannelResolveResult> {
  return new Promise((resolve, reject) => {
    const cbId = `kick-ch-${Date.now()}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Timeout — make sure you've visited kick.com recently"));
    }, 15000);

    function handler(e: MessageEvent) {
      if (e.data?.type === "kick-channel-resolved" && e.data.callbackId === cbId) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve({
          vods: e.data.vods || [],
          playbackUrl: e.data.playbackUrl || null,
          isLive: Boolean(e.data.isLive),
          title: e.data.title || slug.toUpperCase(),
        });
      }
    }

    window.addEventListener("message", handler);
    window.open(
      `/kick-channel.html?slug=${slug}&cb=${cbId}`,
      "kick-resolve",
      "width=400,height=200"
    );
  });
}

/** Resolve a VOD UUID → m3u8 source via popup (uses browser's Cloudflare cookies) */
function resolveVodViaPopup(videoId: string): Promise<{
  source: string;
  title: string;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const cbId = `kick-${Date.now()}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Timeout — make sure you've visited kick.com recently"));
    }, 15000);

    function handler(e: MessageEvent) {
      if (e.data?.type === "kick-vod-resolved" && e.data.callbackId === cbId) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve({
          source: e.data.source,
          title: e.data.title || "Untitled VOD",
          duration: e.data.duration || 0,
        });
      }
    }

    window.addEventListener("message", handler);
    window.open(
      `/kick-resolve.html?video=${videoId}&cb=${cbId}`,
      "kick-resolve",
      "width=400,height=200"
    );
  });
}

/* ── Component ────────────────────────────────────────────────── */

export default function KickVodWidget() {
  const [streamers, setStreamers, hydrated] = useLocalStorage<Streamer[]>(
    "sm-kick-streamers",
    []
  );
  const [view, setView] = useState<View>("streamers");
  const [activeStreamer, setActiveStreamer] = useState<Streamer | null>(null);
  const [vods, setVods] = useState<VodEntry[]>([]);
  const [vodsLoading, setVodsLoading] = useState(false);
  const [playing, setPlaying] = useState<PlayingVod | null>(null);
  const [playingLive, setPlayingLive] = useState<PlayingLive | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [vodError, setVodError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [flowMode, setFlowMode] = useState(false);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("vod");
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const volumeBeforeMuteRef = useRef(100);

  // Listen for flow mode
  useEffect(() => {
    const check = () =>
      setFlowMode(document.documentElement.getAttribute("data-flow") === "true");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-flow"],
    });
    return () => observer.disconnect();
  }, []);

  // Load HLS
  const loadHls = useCallback((url: string, isLive: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (Hls.isSupported()) {
      const hls = new Hls({
        // For dashboard viewing, prefer smoother live playback over chasing the lowest latency.
        lowLatencyMode: false,
        liveSyncDurationCount: isLive ? 6 : undefined,
        liveMaxLatencyDurationCount: isLive ? 10 : undefined,
        maxBufferLength: isLive ? 45 : undefined,
        backBufferLength: isLive ? 90 : undefined,
        maxLiveSyncPlaybackRate: 1,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      const seekToLiveEdge = (force = false) => {
        const liveSyncPosition = hls.liveSyncPosition;
        if (!isLive || liveSyncPosition == null || !Number.isFinite(liveSyncPosition)) return;
        if (!force) {
          const maxLatency = hls.maxLatency;
          const latency = hls.latency;
          if (
            !Number.isFinite(latency) ||
            !Number.isFinite(maxLatency) ||
            maxLatency <= 0 ||
            latency <= maxLatency
          ) {
            return;
          }
        }
        video.currentTime = Math.max(liveSyncPosition - 1, 0);
      };
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (data.details.live) {
          seekToLiveEdge();
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        seekToLiveEdge(true);
        video.muted = muted;
        video.volume = (muted ? 0 : volume) / 100;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data: LiveErrorData) => {
        const detail = data.details || "unknown";
        const status = data.response?.code ? ` (${data.response.code})` : "";
        setVodError(`Live stream load failed: ${detail}${status}`);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        if (isLive && video.seekable.length > 0 && Number.isFinite(video.seekable.end(video.seekable.length - 1))) {
          const liveEdge = video.seekable.end(video.seekable.length - 1);
          video.currentTime = Math.max(liveEdge - 1, 0);
        }
        video.muted = muted;
        video.volume = (muted ? 0 : volume) / 100;
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => {
        setVodError("Live stream load failed in native HLS player");
      }, { once: true });
    }
  }, [muted, volume]);

  // When playback source changes, load HLS
  useEffect(() => {
    const activeUrl = playerMode === "live" ? playingLive?.hlsUrl : playing?.hlsUrl;
    if (!activeUrl) return;
    loadHls(activeUrl, playerMode === "live");
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [loadHls, playerMode, playing, playingLive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = (muted ? 0 : volume) / 100;
  }, [muted, volume, playerMode, playing, playingLive]);

  // Fetch VODs for a streamer via popup resolver for channel data
  const fetchVods = useCallback(async (slug: string) => {
    setVodsLoading(true);
    setVodError(null);
    setVods([]);
    try {
      // Try server-side proxy first
      const res = await fetch(`/api/kick?path=/api/v1/channels/${slug}`);
      if (!res.ok) throw new Error("blocked");
      const data = await res.json();
      if (data.error) throw new Error("blocked");
      const streams = data?.previous_livestreams || [];
      const vodList: VodEntry[] = streams.slice(0, 20).map((ls: {
        video?: { uuid?: string };
        session_title?: string;
        thumbnail?: { src?: string; url?: string };
        created_at?: string;
        duration?: number;
      }) => ({
        uuid: ls.video?.uuid || "",
        title: ls.session_title || "Untitled",
        thumbnail: ls.thumbnail?.src || ls.thumbnail?.url || null,
        createdAt: ls.created_at || "",
        duration: ls.duration ? formatDuration(Math.floor(ls.duration / 1000)) : "",
      })).filter((v: VodEntry) => v.uuid);
      setVods(vodList);
      if (vodList.length === 0) setVodError("No VODs found");
    } catch {
      // Fallback: popup resolver (uses browser's Cloudflare cookies)
      try {
        const channelData = await resolveChannelViaPopup(slug);
        const vodList: VodEntry[] = channelData.vods.map((v) => ({
          uuid: v.uuid,
          title: v.title,
          thumbnail: v.thumbnail,
          createdAt: v.createdAt,
          duration: v.duration ? formatDuration(Math.floor(v.duration / 1000)) : "",
        })).filter((v) => v.uuid);
        setVods(vodList);
        if (vodList.length === 0) setVodError("No VODs found");
      } catch (err) {
        setVodError(err instanceof Error ? err.message : "Failed to load VODs");
      }
    } finally {
      setVodsLoading(false);
    }
  }, []);

  // Resolve and play a VOD
  const resolveAndPlay = useCallback(async (vodUuid: string, title: string, streamerSlug: string) => {
    setResolving(true);
    setVodError(null);
    setPlayingLive(null);
    setPlayerMode("vod");
    try {
      // Try server proxy first
      const res = await fetch(`/api/kick?path=/api/v1/video/${vodUuid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.source) {
          setPlaying({ uuid: vodUuid, title: data.livestream?.session_title || title, streamer: streamerSlug, hlsUrl: data.source });
          setView("player");
          setResolving(false);
          return;
        }
      }
    } catch { /* fall through to popup */ }

    // Fallback: popup resolver (uses browser's Cloudflare cookies)
    try {
      const result = await resolveVodViaPopup(vodUuid);
      setPlaying({ uuid: vodUuid, title: result.title || title, streamer: streamerSlug, hlsUrl: result.source });
      setView("player");
    } catch (err) {
      setVodError(err instanceof Error ? err.message : "Failed to resolve VOD");
    } finally {
      setResolving(false);
    }
  }, []);

  // Add streamer
  const addStreamer = () => {
    const slug = newSlug.trim().toLowerCase().replace(/^https?:\/\/kick\.com\//, "").replace(/\/.*$/, "");
    if (!slug) return;
    if (streamers.some((s) => s.slug === slug)) {
      setAddError("Already added");
      return;
    }
    setStreamers((prev) => [...prev, { slug, label: slug.toUpperCase() }]);
    setNewSlug("");
    setShowAdd(false);
    setAddError(null);
  };

  const removeStreamer = (slug: string) => {
    setStreamers((prev) => prev.filter((s) => s.slug !== slug));
  };

  const openStreamerVods = (streamer: Streamer) => {
    setPlaying(null);
    setPlayingLive(null);
    setPlayerMode("vod");
    setActiveStreamer(streamer);
    setView("vods");
    fetchVods(streamer.slug);
  };

  const openLiveStream = useCallback(async (streamer: Streamer) => {
    setResolving(true);
    setVodError(null);
    setActiveStreamer(streamer);
    setPlaying(null);
    setPlayingLive(null);
    try {
      const res = await fetch(`/api/kick?path=/api/v1/channels/${streamer.slug}`);
      if (!res.ok) throw new Error("blocked");
      const data = await res.json();
      if (data.error) throw new Error("blocked");
      if (!data.playback_url) {
        throw new Error("This channel is offline right now");
      }
      setPlayingLive({
        slug: streamer.slug,
        title: data.livestream?.session_title || `${streamer.label} LIVE`,
        hlsUrl: getProxiedLiveUrl(data.playback_url),
      });
      setPlayerMode("live");
      setView("player");
    } catch {
      try {
        const channelData = await resolveChannelViaPopup(streamer.slug);
        if (!channelData.playbackUrl || !channelData.isLive) {
          throw new Error("This channel is offline right now");
        }
        setPlayingLive({
          slug: streamer.slug,
          title: channelData.title || `${streamer.label} LIVE`,
          hlsUrl: getProxiedLiveUrl(channelData.playbackUrl),
        });
        setPlayerMode("live");
        setView("player");
      } catch (err) {
        setVodError(err instanceof Error ? err.message : "Failed to open live stream");
      }
    } finally {
      setResolving(false);
    }
  }, []);

  const handleBackFromPlayer = () => {
    if (playerMode === "live") {
      setView("streamers");
      return;
    }
    setView(activeStreamer ? "vods" : "streamers");
  };

  // Quick play
  const [manualUrl, setManualUrl] = useState("");
  const playManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    // Kick VOD URL → resolve via popup
    const parsed = parseKickUrl(url);
    if (parsed) {
      setPlayingLive(null);
      setPlayerMode("vod");
      resolveAndPlay(parsed.videoId, parsed.username, parsed.username);
      setManualUrl("");
      return;
    }
    const liveChannel = parseKickChannelUrl(url);
    if (liveChannel) {
      const streamer = { slug: liveChannel.username, label: liveChannel.username.toUpperCase() };
      openLiveStream(streamer);
      setManualUrl("");
      return;
    }
    // Direct m3u8
    if (url.includes(".m3u8")) {
      setPlayingLive(null);
      setPlayerMode("vod");
      setPlaying({ uuid: `manual-${Date.now()}`, title: "Manual VOD", streamer: "", hlsUrl: url });
      setView("player");
      setManualUrl("");
      return;
    }
    setVodError("Paste a Kick channel URL, Kick VOD URL, or m3u8 URL");
  };

  if (!hydrated) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-3 overflow-hidden">
        <div className="text-muted text-xs">Loading...</div>
      </div>
    );
  }

  const indicatorColor = flowMode ? "#ff3333" : "#53fc18";
  const isLiveActive = view === "player" && playerMode === "live" && !!playingLive;
  const indicatorLabel = isLiveActive ? "LIVE" : "VOD";
  const toggleMute = () => {
    if (muted) {
      const restoredVolume = volumeBeforeMuteRef.current || 100;
      setMuted(false);
      setVolume(restoredVolume);
      return;
    }
    volumeBeforeMuteRef.current = volume;
    setMuted(true);
  };

  /* ── Player View ─────────────────────────────────────────────── */
  if (view === "player" && (playing || playingLive)) {
    return (
      <div className="border border-border bg-surface rounded-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackFromPlayer}
              className="text-[10px] text-muted hover:text-green transition-colors cursor-pointer"
            >
              {"<"} Back
            </button>
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium truncate">
              {playerMode === "live" ? playingLive?.title : playing?.title}
            </h2>
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
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? "pulse-dot" : ""}`}
                style={{ backgroundColor: indicatorColor }}
              />
              <span className="text-[9px] uppercase tracking-wider" style={{ color: indicatorColor }}>
                {indicatorLabel}
              </span>
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-black">
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            playsInline
          />
        </div>
      </div>
    );
  }

  /* ── VODs List View ──────────────────────────────────────────── */
  if (view === "vods" && activeStreamer) {
    return (
      <div className="border border-border bg-surface rounded-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("streamers")}
              className="text-[10px] text-muted hover:text-green transition-colors cursor-pointer"
            >
              {"<"} Back
            </button>
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
              {activeStreamer.label} — VODs
            </h2>
          </div>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: indicatorColor }} />
            <span className="text-[9px] uppercase tracking-wider" style={{ color: indicatorColor }}>
              {indicatorLabel}
            </span>
          </span>
        </div>

        {/* Manual URL input */}
        <div className="flex gap-2 px-3 py-2 border-b border-border">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => { setManualUrl(e.target.value); setVodError(null); }}
            onKeyDown={(e) => e.key === "Enter" && playManual()}
            placeholder="Paste channel URL, VOD URL, or m3u8..."
            className="flex-1 bg-background border border-border text-[10px] px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
          />
          <button
            onClick={playManual}
            disabled={resolving}
            className="text-[10px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors disabled:opacity-50"
          >
            {resolving ? "..." : "Play"}
          </button>
        </div>

        {vodError && (
          <div className="px-3 py-1 border-b border-border">
            <span className="text-[9px] text-amber">{vodError}</span>
          </div>
        )}

        {/* VOD list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {vodsLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-[10px] text-muted uppercase tracking-wider">Loading VODs...</span>
            </div>
          ) : vods.length === 0 && !vodError ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-[10px] text-muted uppercase tracking-wider">No VODs</span>
            </div>
          ) : (
            vods.map((vod) => (
              <button
                key={vod.uuid}
                onClick={() => resolveAndPlay(vod.uuid, vod.title, activeStreamer.slug)}
                disabled={resolving}
                className="w-full text-left px-3 py-2 hover:bg-green/5 border-b border-border/50 transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {vod.thumbnail && (
                    <img
                      src={vod.thumbnail}
                      alt=""
                      className="w-16 h-9 flex-shrink-0 border border-border object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-foreground truncate group-hover:text-green transition-colors">
                      {vod.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {vod.duration && (
                        <span className="text-[8px] text-muted">{vod.duration}</span>
                      )}
                      {vod.createdAt && (
                        <span className="text-[8px] text-muted">
                          {new Date(vod.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  /* ── Streamers View (default) ────────────────────────────────── */
  return (
    <div className="border border-border bg-surface rounded-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
            Kick Live + VOD
          </h2>
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? "pulse-dot" : ""}`}
              style={{ backgroundColor: indicatorColor }}
            />
            <span className="text-[9px] uppercase tracking-wider" style={{ color: indicatorColor }}>
              {indicatorLabel}
            </span>
          </span>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setAddError(null); }}
          className="text-[10px] text-muted hover:text-green transition-colors cursor-pointer"
        >
          + Add
        </button>
      </div>

      {/* Add streamer form */}
      {(showAdd || streamers.length === 0) && (
        <div className="flex flex-col gap-1 px-3 py-2 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSlug}
              onChange={(e) => { setNewSlug(e.target.value); setAddError(null); }}
              onKeyDown={(e) => e.key === "Enter" && addStreamer()}
              placeholder="Kick username or channel URL..."
              className="flex-1 bg-background border border-border text-[10px] px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
            />
            <button
              onClick={addStreamer}
              className="text-[10px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors"
            >
              Add
            </button>
          </div>
          {addError && <span className="text-[9px] text-amber">{addError}</span>}
        </div>
      )}

      {/* Quick play */}
      <div className="flex gap-2 px-3 py-2 border-b border-border">
        <input
          type="text"
          value={manualUrl}
          onChange={(e) => { setManualUrl(e.target.value); setVodError(null); }}
          onKeyDown={(e) => e.key === "Enter" && playManual()}
          placeholder="Quick play — paste channel URL, VOD URL, or m3u8..."
          className="flex-1 bg-background border border-border text-[10px] px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
        />
        <button
          onClick={playManual}
          disabled={resolving}
          className="text-[10px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors disabled:opacity-50"
        >
          {resolving ? "..." : "Play"}
        </button>
      </div>

      {vodError && (
        <div className="px-3 py-1 border-b border-border">
          <span className="text-[9px] text-amber">{vodError}</span>
        </div>
      )}

      {/* Streamer list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {streamers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-[10px] uppercase tracking-wider">
            Add a streamer to browse VODs
          </div>
        ) : (
          streamers.map((s) => (
            <div
              key={s.slug}
              className="flex items-center justify-between px-3 py-2 hover:bg-green/5 border-b border-border/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-foreground group-hover:text-green transition-colors font-medium">
                  {s.label}
                </div>
                <span className="text-[9px] text-muted">kick.com/{s.slug}</span>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => openLiveStream(s)}
                  className="text-[9px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors cursor-pointer"
                >
                  Live
                </button>
                <button
                  onClick={() => openStreamerVods(s)}
                  className="text-[9px] uppercase tracking-wider px-2 py-1 border border-border text-muted hover:text-green hover:border-green-dim transition-colors cursor-pointer"
                >
                  VODs
                </button>
              </div>
              <button
                onClick={() => removeStreamer(s.slug)}
                className="text-[9px] text-muted hover:text-red transition-colors cursor-pointer px-1"
                title="Remove"
              >
                x
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
