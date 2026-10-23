import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE, createAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/content", request.url), 303);
  response.cookies.set(ADMIN_AUTH_COOKIE, createAdminSession(), {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
