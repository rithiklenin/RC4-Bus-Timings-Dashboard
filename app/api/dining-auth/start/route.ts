import { NextResponse } from "next/server";

const AUTH_START_URL = "https://inetapps.nus.edu.sg/mnusds/api/TokenAuth/GetStudentUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = await fetch(AUTH_START_URL, { cache: "no-store", redirect: "manual" });
  const location = upstream.headers.get("location");
  if (!location) {
    return NextResponse.json({ error: "NUS did not return a login URL" }, { status: 502 });
  }

  const loginUrl = new URL(location);
  const state = loginUrl.searchParams.get("state");
  const safeRequestId = loginUrl.searchParams.get("safeRequestId");
  if (!state || !safeRequestId) {
    return NextResponse.json({ error: "NUS returned an incomplete login URL" }, { status: 502 });
  }

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set("rc4-dining-oauth", Buffer.from(JSON.stringify({ state, safeRequestId })).toString("base64url"), {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

