import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.delete(ADMIN_AUTH_COOKIE);
  return response;
}
