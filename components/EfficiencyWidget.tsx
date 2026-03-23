"use client";

import { useState, useEffect, useCallback } from "react";
import WidgetCard from "./WidgetCard";
import {
  calculateEfficiency,
  getScoreColor,
  getTrendArrow,
  getTodayKey,
  type DailyScore,
} from "@/lib/efficiency";

export default function EfficiencyWidget() {
  const [score, setScore] = useState(0);
  const [focusHours, setFocusHours] = useState(0);
  const [commits, setCommits] = useState(0);
  const [todosCompleted, setTodosCompleted] = useState(0);
  const [history, setHistory] = useState<DailyScore[]>([]);
  const [mounted, setMounted] = useState(false);

  const recalculate = useCallback(() => {
    const today = getTodayKey();

    try {
      const sessions = JSON.parse(localStorage.getItem("sm-pomodoro-sessions") || "[]");
      const todaySessions = sessions.filter(
        (s: { type: string; completedAt: string }) =>
          s.type === "work" && s.completedAt.startsWith(today)
      );
      const minutes = todaySessions.reduce(
        (acc: number, s: { duration: number }) => acc + s.duration,
        0
      );
      setFocusHours(minutes / 60);
    } catch {
      setFocusHours(0);
    }

    try {
      const todos = JSON.parse(localStorage.getItem("sm-todos") || "[]");
      const completed = todos.filter(
        (t: { done: boolean; createdAt: string }) =>
          t.done && t.createdAt.startsWith(today)
      ).length;
      setTodosCompleted(completed);
    } catch {
      setTodosCompleted(0);
    }

    try {
      const ghData = JSON.parse(localStorage.getItem("sm-github-today") || "0");
      setCommits(ghData);
    } catch {
      setCommits(0);
    }

    try {
      const hist = JSON.parse(localStorage.getItem("sm-efficiency-history") || "[]");
      setHistory(hist);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    recalculate();
    const interval = setInterval(recalculate, 30000);
    return () => clearInterval(interval);
  }, [recalculate]);

  useEffect(() => {
    if (!mounted) return;
    const newScore = calculateEfficiency(focusHours, commits, todosCompleted);
    setScore(newScore);

    const today = getTodayKey();
    const dailyScore: DailyScore = {
      date: today,
      score: newScore,
      focusHours,
      commits,
      todos: todosCompleted,
    };

    try {
      const hist: DailyScore[] = JSON.parse(
        localStorage.getItem("sm-efficiency-history") || "[]"
      );
      const idx = hist.findIndex((h) => h.date === today);
      if (idx >= 0) hist[idx] = dailyScore;
      else hist.push(dailyScore);
      const trimmed = hist.slice(-7);
      localStorage.setItem("sm-efficiency-history", JSON.stringify(trimmed));
      setHistory(trimmed);
    } catch {
      // ignore
    }
  }, [focusHours, commits, todosCompleted, mounted]);

  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 30;
  const yesterday = history.length >= 2 ? history[history.length - 2].score : 0;
  const trend = getTrendArrow(score, yesterday);
  const maxHistScore = Math.max(...history.map((h) => h.score), 1);

  if (!mounted) {
    return (
      <WidgetCard title="Efficiency">
        <div className="text-muted text-xs">Loading...</div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Efficiency">
      <div className="flex flex-col items-center gap-1 h-full justify-center">
        {/* Compact gauge ring */}
        <div className="relative w-16 h-16">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke="var(--border)"
              strokeWidth="4"
            />
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score / 100)}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold" style={{ color }}>
              {score}
            </span>
          </div>
        </div>

        <span className="text-[8px] text-muted uppercase tracking-wider">
          {trend} score
        </span>

        {/* 7-day sparkline */}
        {history.length > 1 && (
          <div className="flex items-end gap-0.5 h-4">
            {history.map((h) => (
              <div
                key={h.date}
                className="w-1.5 rounded-sm transition-all duration-300"
                style={{
                  height: `${Math.max((h.score / maxHistScore) * 100, 10)}%`,
                  backgroundColor: getScoreColor(h.score),
                  opacity: h.date === getTodayKey() ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
