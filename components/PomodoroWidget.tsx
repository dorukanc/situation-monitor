"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import WidgetCard from "./WidgetCard";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { sendTickerMessage } from "./StatusTicker";
import { CONFIG } from "@/lib/config";

interface PomodoroSession {
  startedAt: string;
  completedAt: string;
  type: "work" | "break";
  duration: number;
}

export default function PomodoroWidget() {
  const [sessions, setSessions, hydrated] = useLocalStorage<PomodoroSession[]>(
    "sm-pomodoro-sessions",
    []
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CONFIG.pomodoro.workMinutes * 60);
  const [sessionCount, setSessionCount] = useState(0);
  const startTimeRef = useRef<string>("");

  const totalMinutes = isBreak ? CONFIG.pomodoro.breakMinutes : CONFIG.pomodoro.workMinutes;
  const totalSeconds = totalMinutes * 60;

  const completeSession = useCallback(() => {
    const session: PomodoroSession = {
      startedAt: startTimeRef.current,
      completedAt: new Date().toISOString(),
      type: isBreak ? "break" : "work",
      duration: totalMinutes,
    };
    setSessions((prev) => [...prev, session]);

    if (!isBreak) {
      setSessionCount((c) => c + 1);
      sendTickerMessage(`POMODORO #${sessionCount + 1} COMPLETE`);
      setIsBreak(true);
      setSecondsLeft(CONFIG.pomodoro.breakMinutes * 60);
    } else {
      sendTickerMessage("BREAK OVER");
      setIsBreak(false);
      setSecondsLeft(CONFIG.pomodoro.workMinutes * 60);
    }
    setIsRunning(false);
  }, [isBreak, sessionCount, totalMinutes, setSessions]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, completeSession]);

  const start = () => {
    if (!isRunning) startTimeRef.current = new Date().toISOString();
    setIsRunning(true);
  };
  const pause = () => setIsRunning(false);
  const reset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setSecondsLeft(CONFIG.pomodoro.workMinutes * 60);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = 1 - secondsLeft / totalSeconds;
  const circumference = 2 * Math.PI * 30;

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter(
    (s) => s.type === "work" && s.completedAt.startsWith(today)
  );

  if (!hydrated) {
    return (
      <WidgetCard title="Pomodoro">
        <div className="text-muted text-xs">Loading...</div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Pomodoro">
      <div className="flex flex-col items-center gap-1 h-full justify-center">
        {/* Compact ring */}
        <div className="relative w-16 h-16">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="30" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="40" cy="40" r="30" fill="none"
              stroke={isBreak ? "var(--amber)" : "var(--green)"}
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-foreground">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        </div>

        <span className="text-[8px] uppercase tracking-wider text-muted">
          {isBreak ? "Break" : "Focus"} #{todaySessions.length + (isRunning && !isBreak ? 1 : 0)}
        </span>

        {/* Controls */}
        <div className="flex gap-1">
          {!isRunning ? (
            <button
              onClick={start}
              className="text-[9px] uppercase tracking-wider px-2 py-0.5 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors"
            >
              {secondsLeft < totalSeconds ? "Go" : "Start"}
            </button>
          ) : (
            <button
              onClick={pause}
              className="text-[9px] uppercase tracking-wider px-2 py-0.5 border border-amber text-amber hover:bg-amber/10 transition-colors"
            >
              Pause
            </button>
          )}
          <button
            onClick={reset}
            className="text-[9px] uppercase tracking-wider px-2 py-0.5 border border-muted text-muted hover:bg-muted/10 transition-colors"
          >
            Rst
          </button>
        </div>
      </div>
    </WidgetCard>
  );
}
