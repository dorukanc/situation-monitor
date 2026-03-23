export type WidgetSize = "normal" | "mini";

export interface WidgetMeta {
  id: string;
  name: string;
  size: WidgetSize;
  description: string;
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  { id: "globe", name: "Globe", size: "normal", description: "3D globe with commit pulses & world clocks" },
  { id: "github", name: "GitHub", size: "normal", description: "Commit activity heatmap" },
  { id: "todo", name: "Tasks", size: "normal", description: "Task list with time tracking" },
  { id: "hackernews", name: "Hacker News", size: "normal", description: "Top HN stories feed" },
  { id: "spotify", name: "Spotify", size: "normal", description: "Music player & playlists" },
  { id: "youtube", name: "YouTube", size: "normal", description: "Live stream embeds" },
  { id: "ytmusic", name: "YT Music", size: "normal", description: "YouTube Music player & playlists" },
  { id: "clock", name: "Clock", size: "mini", description: "Current time & date" },
  { id: "efficiency", name: "Efficiency", size: "mini", description: "Daily productivity score" },
  { id: "weather", name: "Weather", size: "mini", description: "Current weather conditions" },
  { id: "pomodoro", name: "Pomodoro", size: "mini", description: "Focus timer (25/5 cycle)" },
];

export const DEFAULT_LAYOUT: string[] = [
  "globe", "github", "todo", "hackernews", "spotify",
  "clock", "efficiency", "weather", "pomodoro",
];

export const LAYOUT_STORAGE_KEY = "sm-widget-layout";

export function getWidgetMeta(id: string): WidgetMeta | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}
