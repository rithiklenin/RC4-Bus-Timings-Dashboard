import { getDiningMenu } from "@/lib/dining-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getDiningMenu(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dining menu unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}

