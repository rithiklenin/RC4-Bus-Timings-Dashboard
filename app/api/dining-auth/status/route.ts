import { getDiningAuthStatus } from "@/lib/dining-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getDiningAuthStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

