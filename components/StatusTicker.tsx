"use client";

import { useState, useEffect } from "react";
import { useFlowMode } from "@/hooks/useFlowMode";
import FlowCharacterLane from "./FlowCharacterLane";

type StatusTickerProps = {
  initialFlow?: boolean;
};

export default function StatusTicker({ initialFlow = false }: StatusTickerProps) {
  const [messages, setMessages] = useState<string[]>([
    "SYSTEM ONLINE",
    "SITUATION MONITOR v1.0",
    "ALL SYSTEMS NOMINAL",
  ]);
  const flowMode = useFlowMode(initialFlow);

  useEffect(() => {
    const handler = (e: CustomEvent<string>) => {
      setMessages((prev) => [...prev.slice(-19), e.detail]);
    };
    window.addEventListener("ticker-message" as string, handler as EventListener);
    return () => window.removeEventListener("ticker-message" as string, handler as EventListener);
  }, []);

  const text = messages.map((m) => `\u25C6 ${m}`).join("  \u25C6  ");
  const doubled = `${text}  \u25C6  ${text}`;

  return (
    <div
      className={`status-rail relative border-t border-border bg-surface transition-[height] duration-200 ${
        flowMode ? "z-20 h-[4.5rem] overflow-visible" : "h-8 overflow-hidden"
      }`}
    >
      {flowMode ? (
        <FlowCharacterLane />
      ) : (
        <div className="flex h-full items-center overflow-hidden">
          <div className="ticker-animate whitespace-nowrap flex items-center">
            <span className="text-[10px] uppercase tracking-[0.15em] text-green-dim">
              {doubled}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function sendTickerMessage(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ticker-message", { detail: message }));
  }
}
