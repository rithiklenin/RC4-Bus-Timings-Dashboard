import { getAdminUser } from "@/lib/admin-auth";
import { clearDiningAuth } from "@/lib/dining-auth";
import { diningErrorResponse } from "@/lib/dining-responses";

export const runtime = "nodejs";

export async function POST() {
  if (!await getAdminUser()) return Response.json({ error: "Admin login required" }, { status: 401 });
  try {
    await clearDiningAuth();
    return Response.json({ connected: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diningErrorResponse(error, "Unable to disconnect Dining"); }
}

