"use client";

import { useState, useEffect, useCallback } from "react";
import WidgetCard from "./WidgetCard";
import { CONFIG } from "@/lib/config";

interface DayCommits {
  date: string;
  count: number;
  label: string;
}

export default function GitHubActivity() {
  const [days, setDays] = useState<DayCommits[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState(false);

  useEffect(() => {
    const check = () => {
      setFlowMode(document.documentElement.getAttribute("data-flow") === "true");
    };

    check();

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-flow"],
    });

    return () => observer.disconnect();
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/github");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: { date: string; count: number }[] = await res.json();
      setDays(
        data.map((d) => ({
          ...d,
          label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "short",
          }),
        }))
      );
      // Cache today's commits for efficiency widget
      const todayCommits = res.headers.get("X-Today-Commits");
      if (todayCommits) {
        localStorage.setItem("sm-github-today", todayCommits);
      }
      setError(null);
    } catch {
      setError("Unable to fetch GitHub data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, CONFIG.github.refreshInterval);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const totalCommits = days.reduce((sum, d) => sum + d.count, 0);
  const barColor = flowMode ? "#ff3333" : "var(--green)";

  return (
    <WidgetCard title="GitHub Commits">
      {loading ? (
        <div className="text-muted text-xs flex items-center justify-center h-full">
          Fetching...
        </div>
      ) : error ? (
        <div className="text-muted text-xs flex items-center justify-center h-full">
          {error}
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Total */}
          <div className="flex items-baseline gap-2 mb-2 flex-shrink-0">
            <span className="text-xl font-bold text-green">{totalCommits}</span>
            <span className="text-[10px] text-muted uppercase tracking-wider">this week</span>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-2 flex-1 px-1 min-h-0">
            {days.map((day) => {
              const heightPercent = day.count > 0 ? (day.count / maxCount) * 100 : 0;
              return (
                <div key={day.date} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
                  <span className="text-[10px] text-green font-bold">{day.count || ""}</span>
                  <div
                    className="w-full rounded-sm transition-all duration-500"
                    style={{
                      height: `${heightPercent}%`,
                      minHeight: day.count > 0 ? "4px" : "0px",
                      backgroundColor: day.count > 0 ? barColor : "transparent",
                      opacity: day.count > 0 ? 0.4 + (day.count / maxCount) * 0.6 : 0,
                    }}
                  />
                  {/* Zero marker */}
                  {day.count === 0 && (
                    <div className="w-full h-[2px] rounded-full bg-border" />
                  )}
                  <span className="text-[9px] text-muted uppercase">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
