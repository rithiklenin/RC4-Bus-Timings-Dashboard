import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { storeDiningAuth, type DiningAuthResult } from "@/lib/dining-auth";

const AUTH_COMPLETE_URL = "https://inetapps.nus.edu.sg/mnusds/api/TokenAuth/Student";

export const runtime = "nodejs";

interface PendingLogin {
  safeRequestId: string;
  state: string;
}

function readPendingLogin(value: string | undefined): PendingLogin | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PendingLogin;
  } catch {
    return null;
  }
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
  const pending = readPendingLogin(cookieStore.get("rc4-dining-oauth")?.value);
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
  const upstream = await fetch(exchangeUrl, { cache: "no-store" });
  const payload = await upstream.json() as { success?: boolean; result?: DiningAuthResult; error?: { message?: string } };
  if (!upstream.ok || !payload.success || !payload.result?.accessToken) {
    return NextResponse.json({ error: payload.error?.message ?? "NUS rejected the login callback" }, { status: 502 });
  }

  storeDiningAuth(payload.result);
  cookieStore.delete("rc4-dining-oauth");
  return NextResponse.json({ connected: true });
}

