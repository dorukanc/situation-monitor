"use client";

import { useEffect, useState } from "react";
import { applyFlowPreference, persistFlowPreference } from "@/lib/flow";
import { useFlowMode } from "@/hooks/useFlowMode";
import {
  FLOW_SESSION_CHANGE_EVENT,
  FLOW_SESSION_HEARTBEAT_MS,
  getActiveFlowSession,
  getFlowSessionDurationSeconds,
  readFlowSessions,
  startFlowSession,
  stopFlowSession,
  syncFlowSessionState,
  touchFlowSessionHeartbeat,
} from "@/lib/flow-sessions";

type FlowToggleProps = {
  initialFlow?: boolean;
};

export default function FlowToggle({ initialFlow = false }: FlowToggleProps) {
  const flow = useFlowMode(initialFlow);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const { activeSession } = syncFlowSessionState(flow);
    const frameId = window.requestAnimationFrame(() => {
      setElapsed(activeSession ? getFlowSessionDurationSeconds(activeSession) : 0);
    });

    if (!flow) {
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const tickIntervalId = window.setInterval(() => {
      setElapsed(readActiveFlowElapsed());
    }, 1000);
    const heartbeatIntervalId = window.setInterval(() => {
      touchFlowSessionHeartbeat();
    }, FLOW_SESSION_HEARTBEAT_MS);

    const handlePageHide = () => {
      touchFlowSessionHeartbeat();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        touchFlowSessionHeartbeat();
        return;
      }

      const synced = syncFlowSessionState(true);
      setElapsed(synced.activeSession ? getFlowSessionDurationSeconds(synced.activeSession) : 0);
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(tickIntervalId);
      window.clearInterval(heartbeatIntervalId);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flow]);

  useEffect(() => {
    const handleChange = () => {
      setElapsed(readActiveFlowElapsed());
    };

    window.addEventListener(FLOW_SESSION_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);

    return () => {
      window.removeEventListener(FLOW_SESSION_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const toggle = () => {
    const next = !flow;
    applyFlowPreference(document.documentElement, next);
    persistFlowPreference(next);

    if (next) {
      startFlowSession();
      setElapsed(readActiveFlowElapsed());
      return;
    }

    stopFlowSession();
    setElapsed(0);
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

function readActiveFlowElapsed() {
  const activeSession = getActiveFlowSession(readFlowSessions());
  return activeSession ? getFlowSessionDurationSeconds(activeSession) : 0;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}
