"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_LAYOUT, LAYOUT_STORAGE_KEY, getWidgetMeta } from "@/lib/widget-registry";
import GlobeWidget from "./GlobeWidget";
import GitHubActivity from "./GitHubActivity";
import TodoWidget from "./TodoWidget";
import PomodoroWidget from "./PomodoroWidget";
import EfficiencyWidget from "./EfficiencyWidget";
import YouTubeWidget from "./YouTubeWidget";
import SpotifyWidget from "./SpotifyWidget";
import YouTubeMusicWidget from "./YouTubeMusicWidget";
import HackerNewsWidget from "./HackerNewsWidget";
import ClockWidget from "./ClockWidget";
import WeatherWidget from "./WeatherWidget";
import StopwatchWidget from "./StopwatchWidget";
import KickVodWidget from "./KickVodWidget";
import WorkTimeWidget from "./WorkTimeWidget";
import WidgetPane from "./WidgetPane";

const WORKTIME_LAYOUT_MIGRATION_KEY = "sm-layout-migration-worktime-v1";

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  globe: GlobeWidget,
  github: GitHubActivity,
  todo: TodoWidget,
  hackernews: HackerNewsWidget,
  spotify: SpotifyWidget,
  youtube: YouTubeWidget,
  ytmusic: YouTubeMusicWidget,
  clock: ClockWidget,
  efficiency: EfficiencyWidget,
  weather: WeatherWidget,
  pomodoro: PomodoroWidget,
  stopwatch: StopwatchWidget,
  kickvod: KickVodWidget,
  worktime: WorkTimeWidget,
};

export default function DashboardGrid() {
  const [layout, setLayout] = useState<string[]>(DEFAULT_LAYOUT);
  const [hydrated, setHydrated] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);

  useEffect(() => {
    let hydrationFrameId: number | null = null;
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasMigratedWorkTime = localStorage.getItem(WORKTIME_LAYOUT_MIGRATION_KEY) === "true";
          const shouldAppendWorkTime = !hasMigratedWorkTime && !parsed.includes("worktime");
          const nextLayout = shouldAppendWorkTime ? [...parsed, "worktime"] : parsed;
          window.requestAnimationFrame(() => {
            setLayout(nextLayout);
          });
          if (shouldAppendWorkTime) {
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
            localStorage.setItem(WORKTIME_LAYOUT_MIGRATION_KEY, "true");
          } else if (!hasMigratedWorkTime && parsed.includes("worktime")) {
            localStorage.setItem(WORKTIME_LAYOUT_MIGRATION_KEY, "true");
          }
        }
      } catch {
        // use default
        localStorage.setItem(WORKTIME_LAYOUT_MIGRATION_KEY, "true");
      }
    } else {
      localStorage.setItem(WORKTIME_LAYOUT_MIGRATION_KEY, "true");
    }

    hydrationFrameId = window.requestAnimationFrame(() => {
      setHydrated(true);
    });

    return () => {
      if (hydrationFrameId !== null) {
        window.cancelAnimationFrame(hydrationFrameId);
      }
    };
  }, []);

  const updateLayout = useCallback((newLayout: string[]) => {
    setLayout(newLayout);
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
  }, []);

  // Split layout into normal widgets and mini widgets (grouped)
  const renderWidgets = () => {
    const elements: React.ReactNode[] = [];
    const miniBuffer: string[] = [];

    const flushMinis = () => {
      if (miniBuffer.length === 0) return;
      // Count how many "slots" are used (mini-wide = 2 slots, mini = 1 slot)
      const slots = miniBuffer.reduce((sum, id) => {
        const m = getWidgetMeta(id);
        return sum + (m?.size === "mini-wide" ? 2 : 1);
      }, 0);
      const rows = Math.ceil(slots / 2);
      elements.push(
        <div
          key={`mini-group-${miniBuffer.join("-")}`}
          className="grid grid-cols-2 gap-2 min-h-0"
          style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
          {miniBuffer.map((id) => {
            const Component = WIDGET_COMPONENTS[id];
            return Component ? <Component key={id} /> : null;
          })}
        </div>
      );
      miniBuffer.length = 0;
    };

    for (const id of layout) {
      const meta = getWidgetMeta(id);
      if (!meta) continue;

      if (meta.size === "mini" || meta.size === "mini-wide") {
        miniBuffer.push(id);
        // Count slots used so far
        const slots = miniBuffer.reduce((sum, mid) => {
          const m = getWidgetMeta(mid);
          return sum + (m?.size === "mini-wide" ? 2 : 1);
        }, 0);
        if (slots >= 6) {
          flushMinis();
        }
      } else {
        // Flush any pending minis before a normal widget
        flushMinis();
        const Component = WIDGET_COMPONENTS[id];
        if (Component) {
          elements.push(<Component key={id} />);
        }
      }
    }
    // Flush remaining minis
    flushMinis();

    return elements;
  };

  // Compute grid dimensions based on widget count
  const normalCount = layout.filter((id) => getWidgetMeta(id)?.size === "normal").length;
  const miniSlots = layout.reduce((sum, id) => {
    const m = getWidgetMeta(id);
    if (m?.size === "mini") return sum + 1;
    if (m?.size === "mini-wide") return sum + 2;
    return sum;
  }, 0);
  const miniGroups = miniSlots > 0 ? Math.ceil(miniSlots / 6) : 0;
  const totalCells = normalCount + miniGroups;
  const cols = totalCells <= 4 ? 2 : 3;
  const rows = Math.ceil(totalCells / cols);

  if (!hydrated) {
    return <main className="flex-1 p-3 min-h-0 overflow-hidden" />;
  }

  return (
    <>
      <main
        className="flex-1 p-3 gap-3 min-h-0 overflow-hidden grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {renderWidgets()}
      </main>

      {/* Settings button */}
      <button
        onClick={() => setPaneOpen(true)}
        className="fixed bottom-12 right-3 w-8 h-8 border border-border bg-surface flex items-center justify-center hover:border-green/30 hover:text-green text-muted transition-colors cursor-pointer z-40"
        title="Customize widgets"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Widget pane */}
      <WidgetPane
        open={paneOpen}
        onClose={() => setPaneOpen(false)}
        layout={layout}
        onLayoutChange={updateLayout}
      />
    </>
  );
}
