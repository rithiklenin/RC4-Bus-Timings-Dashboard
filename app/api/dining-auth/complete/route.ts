import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { storeDiningAuth, type DiningAuthResult } from "@/lib/dining-auth";
import { readPendingDiningLogin } from "@/lib/dining-login";

const AUTH_COMPLETE_URL = "https://inetapps.nus.edu.sg/mnusds/api/TokenAuth/Student";

export const runtime = "nodejs";

interface DiningAuthPayload {
  success?: boolean;
  result?: DiningAuthResult;
  error?: { message?: string };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { callbackUrl?: string } | null;
  if (!body?.callbackUrl) {
    return NextResponse.json({ error: "Paste the final NUS callback URL" }, { status: 400 });
  }

  let callback: URL;
  try {
    callback = new URL(body.callbackUrl);
  } catch {
    return NextResponse.json({ error: "That is not a valid URL" }, { status: 400 });
  }
  if (callback.protocol !== "https:" || callback.hostname !== "inetapps.nus.edu.sg" || callback.pathname !== "/nusds/login/student") {
    return NextResponse.json({ error: "This is not the expected NUS Dining callback URL" }, { status: 400 });
  }

  const code = callback.searchParams.get("code");
  const state = callback.searchParams.get("state");
  const callbackSafeRequestId = callback.searchParams.get("safeRequestId");
  const cookieStore = await cookies();
  const pending = readPendingDiningLogin(cookieStore.get("rc4-dining-oauth")?.value);
  if (!code || !state || !pending) {
    return NextResponse.json({ error: "The callback or local login session is incomplete" }, { status: 400 });
  }
  if (state !== pending.state || (callbackSafeRequestId && callbackSafeRequestId !== pending.safeRequestId)) {
    return NextResponse.json({ error: "The NUS callback does not match this login attempt" }, { status: 400 });
  }
  const safeRequestId = callbackSafeRequestId ?? pending.safeRequestId;

  const exchangeUrl = new URL(AUTH_COMPLETE_URL);
  exchangeUrl.searchParams.set("safeRequestId", safeRequestId);
  exchangeUrl.searchParams.set("code", code);
  exchangeUrl.searchParams.set("state", state);
  try {
    const upstream = await fetch(exchangeUrl, {
      cache: "no-store",
      headers: pending.upstreamCookie ? { Cookie: pending.upstreamCookie } : undefined,
    });
    const responseText = await upstream.text();
    let payload: DiningAuthPayload | null = null;
    try {
      payload = responseText ? JSON.parse(responseText) as DiningAuthPayload : null;
    } catch {
      // Report the upstream status below without exposing its HTML or proxy response.
    }
    if (!upstream.ok || !payload?.success || !payload.result?.accessToken) {
      const upstreamMessage = payload?.error?.message;
      const invalidGrant = /invalid_grant|MSIS9612/i.test(upstreamMessage ?? "");
      const error = invalidGrant
        ? "NUS rejected this one-time authorization code. Start a new Dining login and connect it immediately; callback URLs cannot be reused."
        : upstreamMessage ?? `NUS returned ${upstream.status}${responseText ? " with a non-JSON response" : " with an empty response"}`;
      return NextResponse.json({ error }, { status: invalidGrant ? 400 : 502 });
    }

    await storeDiningAuth(payload.result);
    cookieStore.delete("rc4-dining-oauth");
    return NextResponse.json({ connected: true });
  } catch (error) {
    console.error(
      "Dining authentication completion failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({
      error: "The Dining connection failed on the server. Check the deployment function logs and try a new login.",
    }, { status: 502 });
  }
}

