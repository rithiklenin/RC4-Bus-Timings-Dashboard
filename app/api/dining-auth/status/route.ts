import { getDiningAuthStatus } from "@/lib/dining-auth";
import { diningErrorResponse } from "@/lib/dining-responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getDiningAuthStatus(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diningErrorResponse(error, "Unable to read Dining connection status"); }
}

