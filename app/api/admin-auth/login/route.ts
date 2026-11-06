import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSession, isWhitelistedAdminEmail, normalizeAdminEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

function redirectToLogin(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = normalizeAdminEmail(String(form.get("email") ?? ""));
  const loginUrl = new URL("/admin/login", request.url);
  if (!email || !email.includes("@")) {
    loginUrl.searchParams.set("error", "Enter a valid email address.");
    return redirectToLogin(loginUrl);
  }

  if (!isWhitelistedAdminEmail(email)) {
    loginUrl.searchParams.set("error", "This email is not approved for prototype admin access.");
    return redirectToLogin(loginUrl);
  }

  let session: string;
  try { session = createAdminSession(email); }
  catch {
    loginUrl.searchParams.set("error", "Prototype admin access is not configured for this deployment.");
    return redirectToLogin(loginUrl);
  }

  const response = NextResponse.redirect(new URL("/admin/content", request.url), 303);
  response.cookies.set(ADMIN_AUTH_COOKIE, session, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
