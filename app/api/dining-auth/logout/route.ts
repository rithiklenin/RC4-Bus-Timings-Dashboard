import { clearDiningAuth } from "@/lib/dining-auth";

export const runtime = "nodejs";

export async function POST() {
  clearDiningAuth();
  return Response.json({ connected: false });
}

