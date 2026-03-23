"use client";

import { useState, useEffect, useRef } from "react";
import WidgetCard from "./WidgetCard";

export default function StopwatchWidget() {
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;

    startTimeRef.current = performance.now() - elapsed;

    const tick = () => {
      setElapsed(performance.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setRunning(false);
    setElapsed(0);
  };

  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((elapsed % 1000) / 10);

  const pad = (n: number) => String(n).padStart(2, "0");

  const display = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`
    : `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;

  return (
    <WidgetCard title="Stopwatch" className="col-span-2">
      <div className="flex items-center justify-between h-full gap-3">
        <span className="text-xl font-bold text-green tracking-wider tabular-nums">
          {display}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setRunning(!running)}
            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] border border-green/30 text-green hover:bg-green/10 transition-colors cursor-pointer"
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={reset}
            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] border border-border text-muted hover:text-foreground hover:border-muted transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
    </WidgetCard>
  );
}
