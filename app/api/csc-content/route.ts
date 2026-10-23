import { cookies } from "next/headers";
import { ADMIN_AUTH_COOKIE, isValidAdminSession } from "@/lib/admin-auth";
import { getCscContent, updateCscContent } from "@/lib/csc-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getCscContent(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) {
    return Response.json({ error: "Admin login required" }, { status: 401 });
  }
  try {
    const body = await request.json() as { items?: unknown };
    return Response.json(updateCscContent(body.items), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update highlights" }, { status: 400 });
  }
}
