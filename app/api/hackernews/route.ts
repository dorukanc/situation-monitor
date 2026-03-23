import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";

export async function GET() {
  try {
    const topRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { next: { revalidate: 900 } }
    );
    const topIds: number[] = await topRes.json();
    const ids = topIds.slice(0, CONFIG.hackerNews.storyCount);

    const stories = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );
        return res.json();
      })
    );

    return NextResponse.json(stories);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
