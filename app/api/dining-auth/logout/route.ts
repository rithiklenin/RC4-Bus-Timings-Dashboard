import { clearDiningAuth } from "@/lib/dining-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearDiningAuth();
  return Response.json({ connected: false });
}

