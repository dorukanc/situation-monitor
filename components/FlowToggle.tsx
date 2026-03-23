"use client";

import { useEffect, useState } from "react";

export default function FlowToggle() {
  const [flow, setFlow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sm-flow-mode");
    if (stored === "true") {
      setFlow(true);
      document.documentElement.setAttribute("data-flow", "true");
    }
  }, []);

  const toggle = () => {
    const next = !flow;
    setFlow(next);
    localStorage.setItem("sm-flow-mode", String(next));
    if (next) {
      document.documentElement.setAttribute("data-flow", "true");
    } else {
      document.documentElement.removeAttribute("data-flow");
    }
  };

  if (!mounted) return null;

  return (
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
  );
}
