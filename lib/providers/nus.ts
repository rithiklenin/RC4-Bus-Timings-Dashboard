import type { Arrival, BusStop, LoadLevel } from "@/lib/types";

const DEFAULT_NUS_PROXY = "https://bus.hewliyang.com";

interface NusTiming {
  name?: string;
  arrivalTime?: string | number;
  nextArrivalTime?: string | number;
  arrivalTime_ts?: string;
  nextArrivalTime_ts?: string;
  arrivalTime_capacity?: number;
  arrivalTime_ridership?: number;
  nextArrivalTime_capacity?: number;
  nextArrivalTime_ridership?: number;
}

interface NusResponse {
  etas?: {
    lastUpdated?: string;
    busStopName?: string;
    busStopCaption?: string;
    timings?: NusTiming[];
  };
}

function parseMinutes(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string") return null;
  if (value.trim().toLowerCase() === "arr") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function makeArrival(
  value: string | number | undefined,
  timestamp: string | undefined,
  capacity: number | undefined,
  ridership: number | undefined,
): Arrival | null {
  const minutes = parseMinutes(value);
  if (minutes === null) return null;
  const occupancyPercent = capacity && typeof ridership === "number"
    ? Math.min(100, Math.max(0, Math.round((ridership / capacity) * 100)))
    : undefined;
  const load: LoadLevel = occupancyPercent === undefined
    ? "unknown"
    : occupancyPercent >= 95 ? "full" : occupancyPercent >= 75 ? "limited" : occupancyPercent >= 45 ? "standing" : "seats";
  return {
    minutes,
    estimatedAt: timestamp ?? null,
    load,
    wheelchair: true,
    vehicleType: "shuttle",
    monitored: true,
    occupancyPercent,
  };
}

export function normalizeNusStop(payload: NusResponse): { stop: BusStop; updatedAt: string | null } {
  const etas = payload.etas;
  if (!etas || !Array.isArray(etas.timings)) throw new Error("NUS proxy returned an invalid response");

  return {
    updatedAt: etas.lastUpdated ?? null,
    stop: {
      id: etas.busStopName ?? "UTOWN",
      name: etas.busStopCaption ?? "University Town",
      kind: "nus",
      services: etas.timings
        .filter((timing): timing is NusTiming & { name: string } => Boolean(timing.name))
        .map((timing) => ({
          serviceNo: timing.name,
          arrivals: [
            makeArrival(timing.arrivalTime, timing.arrivalTime_ts, timing.arrivalTime_capacity, timing.arrivalTime_ridership),
            makeArrival(timing.nextArrivalTime, timing.nextArrivalTime_ts, timing.nextArrivalTime_capacity, timing.nextArrivalTime_ridership),
          ].filter((arrival): arrival is Arrival => arrival !== null),
        })),
    },
  };
}

export async function fetchNusStop(): Promise<{ stop: BusStop; updatedAt: string | null }> {
  const base = (process.env.NUS_PROXY_BASE_URL || DEFAULT_NUS_PROXY).replace(/\/$/, "");
  const response = await fetch(`${base}/api/stop/UTOWN`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`NUS proxy returned HTTP ${response.status}`);
  return normalizeNusStop((await response.json()) as NusResponse);
}
