import { getDiningMenu } from "@/lib/dining-menu";
import { DiningAuthError } from "@/lib/dining-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getDiningMenu(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof DiningAuthError ? (error.kind === "configuration" || error.kind === "storage" ? 503 : 502) : 502;
    return Response.json({ error: error instanceof DiningAuthError ? error.message : "Dining menu unavailable" }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}

