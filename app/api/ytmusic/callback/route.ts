import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return new NextResponse(
      `<html><body><script>
        window.opener ? window.close() : window.location.href = "/";
      </script><p>Authorization failed. You can close this tab.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = "http://127.0.0.1:3000/api/ytmusic/callback";

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return new NextResponse(
      `<html><body><script>window.close();</script><p>Token exchange failed.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const tokens = await tokenRes.json();

  return new NextResponse(
    `<html><body><script>
      const data = {
        access_token: ${JSON.stringify(tokens.access_token)},
        refresh_token: ${JSON.stringify(tokens.refresh_token)},
        expires_at: Date.now() + ${tokens.expires_in} * 1000
      };
      if (window.opener) {
        window.opener.postMessage({ type: "ytmusic-tokens", payload: data }, "*");
        window.close();
      } else {
        localStorage.setItem("sm-ytmusic-tokens", JSON.stringify(data));
        window.location.href = "/";
      }
    </script><p>Connected! You can close this tab.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
