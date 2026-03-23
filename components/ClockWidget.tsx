"use client";

import { useState, useEffect } from "react";
import WidgetCard from "./WidgetCard";

export default function ClockWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) {
    return (
      <WidgetCard title="Clock">
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-xl font-bold text-green tracking-wider">--:--:--</span>
        </div>
      </WidgetCard>
    );
  }

  const time = now.toLocaleTimeString("en-US", { hour12: false });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <WidgetCard title="Clock">
      <div className="flex flex-col items-center justify-center h-full gap-0.5">
        <span className="text-xl font-bold text-green tracking-wider">{time}</span>
        <span className="text-[9px] text-muted uppercase tracking-wider">{date}</span>
        <span className="text-[8px] text-muted/50 uppercase tracking-wider">{tz}</span>
      </div>
    </WidgetCard>
  );
}
