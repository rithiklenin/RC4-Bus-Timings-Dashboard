import { getAdminUser } from "@/lib/admin-auth";
import { getCscContent, updateCscContent } from "@/lib/csc-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getCscContent(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load highlights" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  if (!await getAdminUser()) {
    return Response.json({ error: "Admin login required" }, { status: 401 });
  }
  try {
    const body = await request.json() as { items?: unknown };
    return Response.json(await updateCscContent(body.items), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update highlights" }, { status: 400 });
  }
}
