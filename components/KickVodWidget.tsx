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

type View = "streamers" | "vods" | "player";

/* ── Helpers ──────────────────────────────────────────────────── */

function parseKickUrl(url: string): { username: string; videoId: string } | null {
  const match = url.match(/kick\.com\/([a-zA-Z0-9_-]+)\/videos\/([a-zA-Z0-9_-]+)/);
  if (match) return { username: match[1], videoId: match[2] };
  return null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Fetch channel VODs via popup (uses browser's Cloudflare cookies) */
function fetchChannelViaPopup(slug: string): Promise<{
  uuid: string;
  title: string;
  thumbnail: string | null;
  createdAt: string;
  duration: number;
}[]> {
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
        resolve(e.data.vods || []);
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
  const [showAdd, setShowAdd] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [vodError, setVodError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [flowMode, setFlowMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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
  const loadHls = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener("loadedmetadata", () => { video.play().catch(() => {}); }, { once: true });
    }
  }, []);

  // When playing changes, load HLS
  useEffect(() => {
    if (!playing?.hlsUrl) return;
    loadHls(playing.hlsUrl);
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playing, loadHls]);

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
        const rawVods = await fetchChannelViaPopup(slug);
        const vodList: VodEntry[] = rawVods.map((v) => ({
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
    setActiveStreamer(streamer);
    setView("vods");
    fetchVods(streamer.slug);
  };

  // Quick play
  const [manualUrl, setManualUrl] = useState("");
  const playManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    // Kick VOD URL → resolve via popup
    const parsed = parseKickUrl(url);
    if (parsed) {
      resolveAndPlay(parsed.videoId, parsed.username, parsed.username);
      setManualUrl("");
      return;
    }
    // Direct m3u8
    if (url.includes(".m3u8")) {
      setPlaying({ uuid: `manual-${Date.now()}`, title: "Manual VOD", streamer: "", hlsUrl: url });
      setView("player");
      setManualUrl("");
      return;
    }
    setVodError("Paste a Kick VOD URL or m3u8 URL");
  };

  if (!hydrated) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-3 overflow-hidden">
        <div className="text-muted text-xs">Loading...</div>
      </div>
    );
  }

  const indicatorColor = flowMode ? "#ff3333" : "#53fc18";

  /* ── Player View ─────────────────────────────────────────────── */
  if (view === "player" && playing) {
    return (
      <div className="border border-border bg-surface rounded-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(activeStreamer ? "vods" : "streamers")}
              className="text-[10px] text-muted hover:text-green transition-colors cursor-pointer"
            >
              {"<"} Back
            </button>
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium truncate">
              {playing.title}
            </h2>
          </div>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: indicatorColor }} />
            <span className="text-[9px] uppercase tracking-wider" style={{ color: indicatorColor }}>
              VOD
            </span>
          </span>
        </div>
        <div className="flex-1 min-h-0 bg-black">
          <video ref={videoRef} className="w-full h-full" controls playsInline />
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
              VOD
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
            placeholder="Paste VOD URL or m3u8..."
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
            Kick VODs
          </h2>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: indicatorColor }} />
            <span className="text-[9px] uppercase tracking-wider" style={{ color: indicatorColor }}>
              VOD
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
          placeholder="Quick play — paste VOD URL or m3u8..."
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
              <button
                onClick={() => openStreamerVods(s)}
                className="flex-1 text-left cursor-pointer"
              >
                <span className="text-[11px] text-foreground group-hover:text-green transition-colors font-medium">
                  {s.label}
                </span>
                <span className="text-[9px] text-muted ml-2">kick.com/{s.slug}</span>
              </button>
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
