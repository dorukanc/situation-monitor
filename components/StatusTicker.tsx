"use client";

import { useState, useEffect } from "react";

export default function StatusTicker() {
  const [messages, setMessages] = useState<string[]>([
    "SYSTEM ONLINE",
    "SITUATION MONITOR v1.0",
    "ALL SYSTEMS NOMINAL",
  ]);

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
    <div className="border-t border-border bg-surface overflow-hidden h-8 flex items-center">
      <div className="ticker-animate whitespace-nowrap flex items-center">
        <span className="text-[10px] uppercase tracking-[0.15em] text-green-dim">
          {doubled}
        </span>
      </div>
    </div>
  );
}

export function sendTickerMessage(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ticker-message", { detail: message }));
  }
}
