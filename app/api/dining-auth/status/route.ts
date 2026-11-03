import { getDiningAuthStatus } from "@/lib/dining-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getDiningAuthStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to read Dining authentication status", error);
    return Response.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unable to read Dining connection status",
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

