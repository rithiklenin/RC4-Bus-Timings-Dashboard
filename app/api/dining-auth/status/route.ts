import { getAdminUser } from "@/lib/admin-auth";
import { getDiningAuthStatus } from "@/lib/dining-auth";
import { diningErrorResponse } from "@/lib/dining-responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getAdminUser()) return Response.json({ error: "Admin login required" }, { status: 401 });
  try {
    return Response.json(await getDiningAuthStatus(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diningErrorResponse(error, "Unable to read Dining connection status"); }
}

