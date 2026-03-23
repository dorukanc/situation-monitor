"use client";

import { useState, useEffect, useCallback } from "react";
import WidgetCard from "./WidgetCard";
import { CONFIG } from "@/lib/config";

interface HNStory {
  id: number;
  title: string;
  url: string;
  score: number;
  descendants: number;
  time: number;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function HackerNewsWidget() {
  const [stories, setStories] = useState<HNStory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch("/api/hackernews");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: HNStory[] = await res.json();
      setStories(data);
    } catch {
      // keep existing stories on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
    const interval = setInterval(fetchStories, CONFIG.hackerNews.refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStories]);

  return (
    <WidgetCard title="HN News Feed">
      {loading && stories.length === 0 ? (
        <div className="text-muted text-xs flex items-center justify-center h-full">
          Fetching stories...
        </div>
      ) : (
        <div className="flex flex-col gap-2 h-full overflow-y-auto">
          {stories.map((story, i) => (
            <a
              key={story.id}
              href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-2 text-xs hover:bg-border/30 p-1.5 -mx-1 rounded-sm transition-colors"
            >
              <span className="text-muted w-4 flex-shrink-0 text-right">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="group-hover:text-green transition-colors leading-snug">
                  {story.title}
                </div>
                <div className="text-[10px] text-muted flex gap-3 mt-1">
                  <span>{story.score} pts</span>
                  <span>{story.descendants ?? 0} comments</span>
                  <span>{timeAgo(story.time)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
