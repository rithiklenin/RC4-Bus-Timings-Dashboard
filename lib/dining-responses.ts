import { DiningAuthError } from "@/lib/dining-auth";

export function diningErrorResponse(error: unknown, fallback: string) {
  const authError = error instanceof DiningAuthError ? error : undefined;
  const status = authError?.kind === "configuration" || authError?.kind === "storage" ? 503
    : authError?.kind === "disconnected" ? 401
      : 502;
  const message = authError?.message ?? fallback;
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
