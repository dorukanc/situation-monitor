"use client";

import { useEffect, useRef, useState } from "react";
import { applyFlowPreference, persistFlowPreference } from "@/lib/flow";
import { useFlowMode } from "@/hooks/useFlowMode";

type FlowToggleProps = {
  initialFlow?: boolean;
};

export default function FlowToggle({ initialFlow = false }: FlowToggleProps) {
  const flow = useFlowMode(initialFlow);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!flow) {
      startTimeRef.current = null;
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    const intervalId = window.setInterval(() => {
      if (startTimeRef.current === null) return;
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [flow]);

  const toggle = () => {
    const next = !flow;
    startTimeRef.current = next ? Date.now() : null;
    setElapsed(0);
    applyFlowPreference(document.documentElement, next);
    persistFlowPreference(next);
  };

  return (
    <div className="flex items-center gap-2">
      {flow && (
        <div className="flex items-center gap-2 rounded border border-red/40 bg-red/10 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red pulse-dot" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-red tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </div>
      )}
      <button
        onClick={toggle}
        className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] border rounded transition-colors ${
          flow
            ? "border-red bg-red/10 text-red"
            : "border-border text-muted hover:text-foreground hover:border-muted"
        }`}
      >
        Flow Mode
      </button>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}
