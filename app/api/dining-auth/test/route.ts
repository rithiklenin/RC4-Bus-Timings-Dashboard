import { diningApiFetch } from "@/lib/dining-auth";
import { diningErrorResponse } from "@/lib/dining-responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await diningApiFetch("User/ProfileDetail");
    const payload = await upstream.json() as { success?: boolean; error?: { message?: string } };
    if (!upstream.ok || !payload.success) {
      return Response.json({ error: "NUS Dining rejected the token" }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
    }
    return Response.json({ connected: true, upstreamStatus: upstream.status }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) { return diningErrorResponse(error, "Connection test failed"); }
}

