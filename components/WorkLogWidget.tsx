"use client";

import { useState, useEffect, useRef } from "react";
import WidgetCard from "./WidgetCard";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { sendTickerMessage } from "./StatusTicker";

interface WorkEntry {
  id: string;
  task: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
}

export default function WorkLogWidget() {
  const [entries, setEntries, hydrated] = useLocalStorage<WorkEntry[]>("sm-worklog", []);
  const [input, setInput] = useState("");
  const [activeEntry, setActiveEntry] = useState<WorkEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick
  useEffect(() => {
    if (activeEntry) {
      intervalRef.current = setInterval(() => {
        const start = new Date(activeEntry.startedAt).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [activeEntry]);

  const startWork = () => {
    const task = input.trim();
    if (!task) return;
    if (activeEntry) stopWork();
    const entry: WorkEntry = {
      id: Date.now().toString(),
      task,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSeconds: 0,
    };
    setActiveEntry(entry);
    setInput("");
    sendTickerMessage(`STARTED: ${task.toUpperCase()}`);
  };

  const stopWork = () => {
    if (!activeEntry) return;
    const duration = Math.floor(
      (Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000
    );
    const completed: WorkEntry = {
      ...activeEntry,
      endedAt: new Date().toISOString(),
      durationSeconds: duration,
    };
    setEntries((prev) => [...prev, completed]);
    sendTickerMessage(
      `COMPLETED: ${activeEntry.task.toUpperCase()} (${formatDuration(duration)})`
    );
    setActiveEntry(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayEntries = entries.filter((e) => e.startedAt.startsWith(today));
  const todayTotalSeconds = todayEntries.reduce((acc, e) => acc + e.durationSeconds, 0);

  // This week total
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEntries = entries.filter((e) => new Date(e.startedAt) >= weekStart);
  const weekTotalSeconds = weekEntries.reduce((acc, e) => acc + e.durationSeconds, 0);

  if (!hydrated) {
    return (
      <WidgetCard title="Work Log">
        <div className="text-muted text-xs">Loading...</div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Work Log">
      <div className="flex flex-col gap-2 h-full">
        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startWork()}
            placeholder="What are you working on?"
            className="flex-1 bg-background border border-border text-xs px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
          />
          {activeEntry ? (
            <button
              onClick={stopWork}
              className="text-[10px] uppercase tracking-wider px-2 py-1 border border-red text-red hover:bg-red/10 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={startWork}
              className="text-[10px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors"
            >
              Start
            </button>
          )}
        </div>

        {/* Active timer */}
        {activeEntry && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-green pulse-dot" />
            <span className="text-green truncate flex-1">{activeEntry.task}</span>
            <span className="text-green font-bold">{formatDuration(elapsed)}</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 text-[10px] text-muted uppercase tracking-wider">
          <span>Today: {formatDuration(todayTotalSeconds)}</span>
          <span>Week: {formatDuration(weekTotalSeconds)}</span>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {todayEntries
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted w-12 flex-shrink-0">
                  {new Date(entry.startedAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
                <span className="w-1 h-1 rounded-full bg-green-dim flex-shrink-0" />
                <span className="truncate flex-1">{entry.task}</span>
                <span className="text-muted flex-shrink-0">
                  {formatDuration(entry.durationSeconds)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </WidgetCard>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
