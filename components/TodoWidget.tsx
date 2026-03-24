"use client";

import { useState, useEffect, useRef } from "react";
import WidgetCard from "./WidgetCard";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { sendTickerMessage } from "./StatusTicker";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  timeSpent: number; // seconds
}

export default function TodoWidget() {
  const [todos, setTodos, hydrated] = useLocalStorage<Todo[]>("sm-todos", []);
  const [input, setInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick for active todo
  useEffect(() => {
    if (activeId) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [activeId]);

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      { id: Date.now().toString(), text, done: false, createdAt: new Date().toISOString(), timeSpent: 0 },
    ]);
    setInput("");
  };

  const toggleTodo = (id: string) => {
    // Stop timer if completing active item
    if (id === activeId) stopTimer();
    const todo = todos.find((t) => t.id === id);
    if (todo && !todo.done) {
      queueMicrotask(() => sendTickerMessage(`TODO COMPLETE: ${todo.text.toUpperCase()}`));
    }
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, done: !t.done };
        }
        return t;
      })
    );
  };

  const deleteTodo = (id: string) => {
    if (id === activeId) stopTimer();
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const startTimer = (id: string) => {
    // Save elapsed time to previous active todo
    if (activeId) {
      setTodos((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, timeSpent: t.timeSpent + elapsed } : t))
      );
    }
    setActiveId(id);
    setElapsed(0);
    const todo = todos.find((t) => t.id === id);
    if (todo) sendTickerMessage(`STARTED: ${todo.text.toUpperCase()}`);
  };

  const stopTimer = () => {
    if (activeId) {
      setTodos((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, timeSpent: t.timeSpent + elapsed } : t))
      );
      const todo = todos.find((t) => t.id === activeId);
      if (todo) sendTickerMessage(`STOPPED: ${todo.text.toUpperCase()} (${formatDuration(todo.timeSpent + elapsed)})`);
    }
    setActiveId(null);
    setElapsed(0);
  };

  const completed = todos.filter((t) => t.done).length;
  const totalTimeToday = todos.reduce((acc, t) => acc + t.timeSpent, 0) + (activeId ? elapsed : 0);

  if (!hydrated) {
    return (
      <WidgetCard title="Tasks">
        <div className="text-muted text-xs">Loading...</div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Tasks">
      <div className="flex flex-col gap-2 h-full">
        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add task..."
            className="flex-1 bg-background border border-border text-xs px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:border-green-dim"
          />
          <button
            onClick={addTodo}
            className="text-[10px] uppercase tracking-wider px-2 py-1 border border-green-dim text-green-dim hover:bg-green-dim/10 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex justify-between text-[10px] text-muted uppercase tracking-wider">
          <span>{completed}/{todos.length} Complete</span>
          <span>Today: {formatDuration(totalTimeToday)}</span>
        </div>

        {/* Active timer */}
        {activeId && (
          <div className="flex items-center gap-2 text-xs bg-green/5 border border-green/20 px-2 py-1.5 rounded-sm">
            <span className="w-2 h-2 rounded-full bg-green pulse-dot flex-shrink-0" />
            <span className="text-green truncate flex-1">
              {todos.find((t) => t.id === activeId)?.text}
            </span>
            <span className="text-green font-bold flex-shrink-0">{formatDuration(elapsed)}</span>
            <button
              onClick={stopTimer}
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-red text-red hover:bg-red/10 transition-colors flex-shrink-0"
            >
              Stop
            </button>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-center gap-2 text-xs group ${
                todo.id === activeId ? "text-green" : ""
              }`}
            >
              <button
                onClick={() => toggleTodo(todo.id)}
                className={`w-3 h-3 border flex-shrink-0 ${
                  todo.done
                    ? "bg-green-dim border-green-dim"
                    : "border-muted hover:border-green-dim"
                }`}
              />
              <span className={`flex-1 truncate ${todo.done ? "line-through text-muted" : ""}`}>
                {todo.text}
              </span>
              {/* Time spent */}
              {todo.timeSpent > 0 && (
                <span className="text-[9px] text-muted flex-shrink-0">
                  {formatDuration(todo.timeSpent + (todo.id === activeId ? elapsed : 0))}
                </span>
              )}
              {/* Timer button */}
              {!todo.done && todo.id !== activeId && (
                <button
                  onClick={() => startTimer(todo.id)}
                  className="text-[9px] text-muted hover:text-green opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Start timer"
                >
                  ▶
                </button>
              )}
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-muted hover:text-red opacity-0 group-hover:opacity-100 text-[10px] transition-opacity flex-shrink-0"
              >
                X
              </button>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
