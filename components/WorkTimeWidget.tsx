"use client";

import { useEffect, useEffectEvent, useState } from "react";
import WidgetCard from "./WidgetCard";
import { useFlowMode } from "@/hooks/useFlowMode";
import {
  FLOW_SESSION_CHANGE_EVENT,
  type FlowSession,
  getActiveFlowSession,
  getFlowSessionDurationInRange,
  getFlowSessionDurationSeconds,
  readFlowSessions,
  syncFlowSessionState,
} from "@/lib/flow-sessions";

type WorkTimeTab = "today" | "week";

interface DayBucket {
  key: string;
  label: string;
  totalSeconds: number;
  startMs: number;
  endMs: number;
}

interface SessionRow {
  id: string;
  label: string;
  rangeLabel: string;
  totalSeconds: number;
  live: boolean;
  startMs: number;
}

export default function WorkTimeWidget() {
  const flow = useFlowMode();
  const [tab, setTab] = useState<WorkTimeTab>("today");
  const [sessions, setSessions] = useState<FlowSession[]>([]);
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refreshSessions = useEffectEvent(() => {
    setSessions(readFlowSessions());
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const synced = syncFlowSessionState(flow);
    const frameId = window.requestAnimationFrame(() => {
      setSessions(synced.sessions);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [flow, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const tickIntervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(tickIntervalId);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const handleChange = () => {
      refreshSessions();
    };

    window.addEventListener(FLOW_SESSION_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);

    return () => {
      window.removeEventListener(FLOW_SESSION_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <WidgetCard title="Work Time">
        <div className="text-muted text-xs">Loading...</div>
      </WidgetCard>
    );
  }

  const dayBuckets = getRecentDayBuckets(sessions, nowMs, 7);
  const todayBucket = dayBuckets[dayBuckets.length - 1];
  const yesterdayBucket = dayBuckets[dayBuckets.length - 2];
  const activeSession = getActiveFlowSession(sessions);
  const liveSeconds = activeSession ? getFlowSessionDurationSeconds(activeSession, nowMs) : 0;
  const todayRows = getDaySessionRows(sessions, todayBucket.startMs, todayBucket.endMs, nowMs);
  const weekTotalSeconds = dayBuckets.reduce((sum, bucket) => sum + bucket.totalSeconds, 0);
  const averageSeconds = Math.round(weekTotalSeconds / dayBuckets.length);
  const bestDay = dayBuckets.reduce((best, bucket) =>
    bucket.totalSeconds > best.totalSeconds ? bucket : best
  );
  const maxDaySeconds = Math.max(...dayBuckets.map((bucket) => bucket.totalSeconds), 1);
  const deltaSeconds = todayBucket.totalSeconds - yesterdayBucket.totalSeconds;

  return (
    <WidgetCard title="Work Time">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
              Flow Sessions
            </span>
            {flow && (
              <span className="rounded border border-green/30 bg-green/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-green">
                Live
              </span>
            )}
          </div>

          <div className="flex gap-1">
            <TabButton active={tab === "today"} onClick={() => setTab("today")}>
              Today
            </TabButton>
            <TabButton active={tab === "week"} onClick={() => setTab("week")}>
              Week
            </TabButton>
          </div>
        </div>

        {tab === "today" ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="rounded-sm border border-green/20 bg-green/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Worked Today</div>
              <div className="mt-1 text-3xl font-bold text-green tabular-nums">
                {formatDurationLong(todayBucket.totalSeconds)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.18em]">
              <MetricBlock
                label={flow ? "Live Session" : "Last Session"}
                value={
                  flow
                    ? formatDurationCompact(liveSeconds)
                    : formatDurationCompact(todayRows[0]?.totalSeconds ?? 0)
                }
              />
              <MetricBlock label="Vs Yesterday" value={formatDelta(deltaSeconds)} />
              <MetricBlock label="Sessions" value={String(todayRows.length)} />
            </div>

            <div className="min-h-0 flex-1 rounded-sm border border-border bg-background p-2">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted">
                <span>Today Timeline</span>
                <span>{formatDurationCompact(todayBucket.totalSeconds)}</span>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1">
                {todayRows.length > 0 ? (
                  todayRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 rounded-sm border border-border bg-surface px-2 py-2"
                    >
                      <div className="w-16 flex-shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted">
                        {row.rangeLabel}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-foreground">
                          {row.live ? "Current flow session" : row.label}
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-green"
                            style={{
                              width: `${Math.max(
                                8,
                                (row.totalSeconds / Math.max(todayBucket.totalSeconds, 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-sm text-green tabular-nums">
                        {formatDurationCompact(row.totalSeconds)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-full min-h-32 items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted">
                    No flow sessions recorded today.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.18em]">
              <MetricBlock label="7D Total" value={formatDurationCompact(weekTotalSeconds)} />
              <MetricBlock label="Avg / Day" value={formatDurationCompact(averageSeconds)} />
              <MetricBlock
                label="Best Day"
                value={`${bestDay.label} ${formatDurationCompact(bestDay.totalSeconds)}`}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-border bg-background p-3">
              <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted">
                <span>Rolling 7 Days</span>
                <span>{formatDurationCompact(weekTotalSeconds)}</span>
              </div>

              <div className="flex min-h-0 flex-1 items-end gap-2">
                {dayBuckets.map((bucket) => {
                  const isToday = bucket.key === todayBucket.key;
                  const barHeight = Math.max((bucket.totalSeconds / maxDaySeconds) * 100, 6);

                  return (
                    <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="w-full text-center text-[10px] text-muted tabular-nums">
                        {formatDurationCompact(bucket.totalSeconds)}
                      </div>
                      <div className="flex h-full min-h-28 w-full items-end rounded-sm border border-border bg-surface px-2 py-2">
                        <div
                          className={`w-full rounded-sm bg-green ${isToday ? "" : "opacity-60"}`}
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <div
                        className={`text-[10px] uppercase tracking-[0.18em] ${
                          isToday ? "text-green" : "text-muted"
                        }`}
                      >
                        {bucket.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-2 py-1 text-[10px] uppercase tracking-[0.2em] transition-colors ${
        active
          ? "border-green/30 bg-green/10 text-green"
          : "border-border text-muted hover:border-green/30 hover:text-green"
      }`}
    >
      {children}
    </button>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-2 py-2">
      <div className="text-muted">{label}</div>
      <div className="mt-1 text-sm text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function getRecentDayBuckets(sessions: FlowSession[], nowMs: number, days: number): DayBucket[] {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const dayStart = new Date(todayStart);
    dayStart.setDate(todayStart.getDate() - (days - index - 1));

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    return {
      key: dayStart.toISOString(),
      label: dayStart.toLocaleDateString(undefined, { weekday: "short" }),
      totalSeconds: sessions.reduce(
        (sum, session) =>
          sum + getFlowSessionDurationInRange(session, dayStart.getTime(), dayEnd.getTime(), nowMs),
        0
      ),
      startMs: dayStart.getTime(),
      endMs: dayEnd.getTime(),
    };
  });
}

function getDaySessionRows(
  sessions: FlowSession[],
  dayStartMs: number,
  dayEndMs: number,
  nowMs: number
): SessionRow[] {
  return sessions
    .map((session) => {
      const sessionStartMs = new Date(session.startedAt).getTime();
      const sessionEndMs = session.endedAt ? new Date(session.endedAt).getTime() : nowMs;
      const clippedStartMs = Math.max(sessionStartMs, dayStartMs);
      const clippedEndMs = Math.min(sessionEndMs, dayEndMs);

      if (clippedEndMs <= clippedStartMs) {
        return null;
      }

      const live = session.endedAt === null && clippedEndMs === nowMs;

      return {
        id: session.id,
        label: sessionStartMs < dayStartMs ? "Continued from earlier" : "Flow session",
        rangeLabel: `${formatTime(clippedStartMs)} - ${live ? "LIVE" : formatTime(clippedEndMs)}`,
        totalSeconds: Math.floor((clippedEndMs - clippedStartMs) / 1000),
        live,
        startMs: clippedStartMs,
      };
    })
    .filter((row): row is SessionRow => row !== null)
    .sort((a, b) => b.startMs - a.startMs);
}

function formatDurationLong(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${totalSeconds}s`;
}

function formatDurationCompact(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${totalSeconds}s`;
}

function formatDelta(totalSeconds: number) {
  if (totalSeconds === 0) {
    return "Flat";
  }

  const sign = totalSeconds > 0 ? "+" : "-";
  return `${sign}${formatDurationCompact(Math.abs(totalSeconds))}`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
