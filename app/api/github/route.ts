import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const username = CONFIG.github.username;
  const token = process.env.GITHUB_TOKEN;

  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const url = `https://api.github.com/users/${username}/events?per_page=100`;
    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(getEmptyWeek());
    }

    const events = await res.json();

    // Count push events per day for last 7 days
    const counts: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      counts[d.toISOString().split("T")[0]] = 0;
    }

    for (const event of events) {
      const date = event.created_at.split("T")[0];
      if (!(date in counts)) continue;

      if (event.type === "PushEvent") {
        // payload.commits exists for public repos, missing for private
        // payload.size has commit count, fall back to 1 per push
        const commitCount =
          event.payload?.commits?.length ??
          event.payload?.size ??
          event.payload?.distinct_size ??
          1;
        counts[date] += commitCount;
      } else if (event.type === "CreateEvent") {
        // Repo/branch creation with initial push — count as 1
        counts[date] += 1;
      }
    }

    const result = Object.entries(counts).map(([date, count]) => ({
      date,
      count,
    }));

    const today = new Date().toISOString().split("T")[0];
    const response = NextResponse.json(result);
    response.headers.set("X-Today-Commits", String(counts[today] || 0));
    return response;
  } catch {
    return NextResponse.json(getEmptyWeek());
  }
}

function getEmptyWeek() {
  const result = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push({ date: d.toISOString().split("T")[0], count: 0 });
  }
  return result;
}
