"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface Channel {
  id: string;
  label: string;
  videoId: string;
}

const DEFAULT_CHANNELS: Channel[] = [
  { id: "tbpn", label: "TBPN", videoId: "live_stream" },
  { id: "sky", label: "SKY", videoId: "YDvsBbKfLPA" },
];

function getEmbedUrl(channel: Channel, muted: boolean): string {
  const muteParam = muted ? "&mute=1" : "";
  if (channel.id === "tbpn") {
    return `https://www.youtube.com/embed/live_stream?channel=UCkMtv5FaxMQ2hRwFZEkCKKg&autoplay=1&enablejsapi=1${muteParam}`;
  }
  return `https://www.youtube.com/embed/${channel.videoId}?autoplay=1&enablejsapi=1${muteParam}`;
}

export default function YouTubeWidget() {
  const [channels, setChannels, hydrated] = useLocalStorage<Channel[]>(
    "sm-live-channels",
    DEFAULT_CHANNELS
  );
  const [activeTab, setActiveTab] = useState(0);
  const [muted, setMuted] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send mute/unmute command to YouTube iframe via postMessage
  const sendPlayerCommand = useCallback((func: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func }),
      "https://www.youtube.com"
    );
  }, []);

  // When muted state changes, send command to iframe (no reload)
  useEffect(() => {
    sendPlayerCommand(muted ? "mute" : "unMute");
  }, [muted, sendPlayerCommand]);

  const toggleMute = () => setMuted((m) => !m);

  const switchTab = (i: number) => {
    setActiveTab(i);
    // Tab switch requires new iframe, mute state will be applied via URL param
  };

  const addChannel = () => {
    const label = newLabel.trim().toUpperCase();
    const url = newUrl.trim();
    if (!label || !url) return;

    const videoId = extractVideoId(url);
    if (!videoId) return;

    const id = label.toLowerCase().replace(/\s+/g, "-");
    if (channels.some((c) => c.id === id)) return;

    setChannels((prev) => [...prev, { id, label, videoId }]);
    setNewLabel("");
    setNewUrl("");
    setShowAdd(false);
    setActiveTab(channels.length);
  };

  const removeChannel = (idx: number) => {
    setChannels((prev) => prev.filter((_, i) => i !== idx));
    if (activeTab >= channels.length - 1) setActiveTab(Math.max(0, channels.length - 2));
  };

  if (!hydrated) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-3 overflow-hidden">
        <div className="text-muted text-xs">Loading...</div>
      </div>
    );
  }

  const active = channels[activeTab];

  return (
    <div className="border border-border bg-surface rounded-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
            Live
          </h2>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red pulse-dot" />
            <span className="text-[9px] uppercase tracking-wider text-red">Live</span>
          </span>
        </div>
        <button
          onClick={toggleMute}
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border transition-colors ${
            muted
              ? "border-muted text-muted hover:border-foreground hover:text-foreground"
              : "border-green-dim text-green-dim"
          }`}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border">
        {channels.map((channel, i) => (
          <button
            key={channel.id}
            onClick={() => switchTab(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (channels.length > 1) removeChannel(i);
            }}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-medium transition-colors border-b-2 ${
              i === activeTab
                ? "border-green text-green bg-green/5"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {channel.label}
          </button>
        ))}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-2 py-1.5 text-[10px] text-muted hover:text-green transition-colors"
        >
          +
        </button>
      </div>

      {/* Add channel form */}
      {showAdd && (
        <div className="flex gap-2 px-3 py-2 border-b border-border">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label..."
            className="w-20 bg-background border border-border text-[10px] px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
          />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChannel()}
            placeholder="YouTube URL..."
            className="flex-1 bg-background border border-border text-[10px] px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
          />
          <button
            onClick={addChannel}
            className="text-[10px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Video player */}
      <div className="flex-1 min-h-0">
        {active ? (
          <iframe
            ref={iframeRef}
            key={active.id}
            src={getEmbedUrl(active, muted)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            No channels added
          </div>
        )}
      </div>
    </div>
  );
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
