import { fetchPublicBusStops } from "@/lib/providers/lta";
import { fetchNusStop } from "@/lib/providers/nus";
import type { ArrivalsResponse, SourceResult } from "@/lib/types";

const safeMessage = (source: string, reason: unknown) => {
  console.error(`${source} arrivals unavailable`, reason instanceof Error ? reason.message : reason);
  return `${source} timings are temporarily unavailable`;
};

export async function getArrivals(now = new Date()): Promise<ArrivalsResponse> {
  const [nusResult, ltaResult] = await Promise.allSettled([fetchNusStop(), fetchPublicBusStops(now)]);

  const nusUpdatedAt = nusResult.status === "fulfilled" ? nusResult.value.updatedAt ?? now.toISOString() : null;
  const nusUpdatedMs = nusUpdatedAt ? Date.parse(nusUpdatedAt) : Number.NaN;
  const nusIsStale = Number.isFinite(nusUpdatedMs) && now.getTime() - nusUpdatedMs > 120_000;

  const nus: SourceResult = nusResult.status === "fulfilled"
    ? { status: "ok", stale: nusIsStale, updatedAt: nusUpdatedAt, stops: [nusResult.value.stop] }
    : { status: "error", stale: true, updatedAt: null, error: safeMessage("NUS", nusResult.reason), stops: [] };

  const publicBus: SourceResult = ltaResult.status === "fulfilled"
    ? { status: "ok", stale: false, updatedAt: now.toISOString(), stops: ltaResult.value }
    : { status: "error", stale: true, updatedAt: null, error: safeMessage("Public bus", ltaResult.reason), stops: [] };

  return { generatedAt: now.toISOString(), nus, publicBus };
}
