import { CONFIG } from "./config";

export interface DailyScore {
  date: string; // YYYY-MM-DD
  score: number;
  focusHours: number;
  commits: number;
  todos: number;
}

export function calculateEfficiency(
  focusHours: number,
  commits: number,
  todosCompleted: number
): number {
  const { targetFocusHours, targetCommits, targetTodos } = CONFIG.efficiency;

  const focusScore = Math.min(focusHours / targetFocusHours, 1.0) * 40;
  const outputScore = Math.min(commits / targetCommits, 1.0) * 35;
  const taskScore = Math.min(todosCompleted / targetTodos, 1.0) * 25;

  return Math.round(focusScore + outputScore + taskScore);
}

export function getScoreColor(score: number): string {
  if (score > 70) return "var(--green)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

export function getTrendArrow(today: number, yesterday: number): string {
  const diff = today - yesterday;
  if (diff > 15) return "\u2191";
  if (diff > 5) return "\u2197";
  if (diff > -5) return "\u2192";
  if (diff > -15) return "\u2198";
  return "\u2193";
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}
