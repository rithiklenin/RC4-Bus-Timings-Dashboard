import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { encodePendingDiningLogin, extractUpstreamSessionCookie } from "@/lib/dining-login";

const AUTH_START_URL = "https://inetapps.nus.edu.sg/mnusds/api/TokenAuth/GetStudentUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await getAdminUser()) return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  let upstream: Response;
  try { upstream = await fetch(AUTH_START_URL, { cache: "no-store", redirect: "manual" }); }
  catch { return NextResponse.json({ error: "Unable to start NUS Dining login" }, { status: 502, headers: { "Cache-Control": "private, no-store" } }); }
  const location = upstream.headers.get("location");
  if (!location) {
    return NextResponse.json({ error: "NUS did not return a login URL" }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }

  const loginUrl = new URL(location);
  const state = loginUrl.searchParams.get("state");
  const safeRequestId = loginUrl.searchParams.get("safeRequestId");
  if (!state || !safeRequestId) {
    return NextResponse.json({ error: "NUS returned an incomplete login URL" }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set("rc4-dining-oauth", encodePendingDiningLogin({
    state,
    safeRequestId,
    upstreamCookie: extractUpstreamSessionCookie(upstream.headers),
  }), {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

