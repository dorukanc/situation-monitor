import { NextRequest, NextResponse } from "next/server";

// CORS proxy for Kick's internal API (Cloudflare-protected).
// Proxies: /api/kick?path=/api/v1/video/{uuid}
//          /api/kick?path=/api/v1/channels/{slug}

const ALLOWED_PATHS = ["/api/v1/video/", "/api/v1/channels/", "/api/v2/channels/"];

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path || !ALLOWED_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://kick.com${path}`, {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Origin: "https://kicktools.net",
        Referer: "https://kicktools.net/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Kick API returned ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch from Kick" }, { status: 500 });
  }
}
