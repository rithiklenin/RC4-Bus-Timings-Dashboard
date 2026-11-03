import { clearDiningAuth } from "@/lib/dining-auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearDiningAuth();
    return Response.json({ connected: false });
  } catch (error) {
    console.error("Unable to clear Dining authentication", error);
    return Response.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unable to disconnect Dining",
    }, { status: 503 });
  }
}

