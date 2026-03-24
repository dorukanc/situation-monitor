import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOST_SUFFIXES = [
  "live-video.net",
  "mediapackage.us-west-2.amazonaws.com",
  "cloudfront.net",
  "ivs.rocks",
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

function rewritePlaylist(content: string, sourceUrl: URL, requestUrl: URL): string {
  const rewriteAttributeUris = (line: string) =>
    line.replace(/URI="([^"]+)"/g, (_match, value: string) => {
      const absolute = new URL(value, sourceUrl).toString();
      const proxied = new URL("/api/kick-live", requestUrl);
      proxied.searchParams.set("url", absolute);
      return `URI="${proxied.toString()}"`;
    });

  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return rewriteAttributeUris(line);
      }

      const absolute = new URL(trimmed, sourceUrl).toString();
      const proxied = new URL("/api/kick-live", requestUrl);
      proxied.searchParams.set("url", absolute);
      return proxied.toString();
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (targetUrl.protocol !== "https:" || !isAllowedHost(targetUrl.hostname)) {
    return NextResponse.json(
      { error: `Blocked url host: ${targetUrl.hostname}` },
      { status: 400 }
    );
  }

  try {
    const upstreamHeaders = new Headers({
      Accept: "*/*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    });
    const range = request.headers.get("range");
    const ifRange = request.headers.get("if-range");
    if (range) upstreamHeaders.set("Range", range);
    if (ifRange) upstreamHeaders.set("If-Range", ifRange);

    const upstream = await fetch(targetUrl.toString(), {
      headers: upstreamHeaders,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isPlaylist =
      targetUrl.pathname.endsWith(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("application/vnd.apple.mpegurl");

    if (isPlaylist) {
      const body = await upstream.text();
      const rewritten = rewritePlaylist(body, targetUrl, request.nextUrl);
      return new Response(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
        },
      });
    }

    const responseHeaders = new Headers();
    const passThroughHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
      "cache-control",
    ];

    for (const headerName of passThroughHeaders) {
      const value = upstream.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    }

    if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("Cache-Control", "no-store");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch live media" }, { status: 500 });
  }
}
