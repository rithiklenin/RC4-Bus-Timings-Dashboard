import { diningApiFetch } from "@/lib/dining-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await diningApiFetch("User/ProfileDetail");
    const payload = await upstream.json() as { success?: boolean; error?: { message?: string } };
    if (!upstream.ok || !payload.success) {
      return Response.json({ connected: false, error: payload.error?.message ?? "NUS Dining rejected the token" }, { status: 502 });
    }
    return Response.json({ connected: true, upstreamStatus: upstream.status }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({ connected: false, error: error instanceof Error ? error.message : "Connection test failed" }, { status: 401 });
  }
}

