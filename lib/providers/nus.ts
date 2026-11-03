import type { Arrival, BusStop, LoadLevel } from "@/lib/types";
import { fetchNusBusShuttleService } from "@/lib/providers/nusbus";
import { fetchUnivusShuttleService } from "@/lib/providers/univus";

const DEFAULT_STOP = "UTOWN";

interface NusShuttleEta {
  eta?: number;
  ts?: string;
}

interface NusShuttle {
  name?: string;
  arrivalTime?: string | number;
  nextArrivalTime?: string | number;
  passengers?: string;
  nextPassengers?: string;
  _etas?: NusShuttleEta[];
}

interface NusShuttleServiceResponse {
  ShuttleServiceResult?: {
    TimeStamp?: string;
    Timestamp?: string;
    name?: string;
    caption?: string;
    shuttles?: NusShuttle[];
  };
}

type NusProvider = "nusbus" | "univus";

function selectedProvider(): NusProvider {
  const configured = process.env.NUS_BUS_PROVIDER?.trim().toLowerCase() || "nusbus";
  if (configured === "nusbus" || configured === "univus") return configured;
  throw new Error(`Unsupported NUS_BUS_PROVIDER: ${configured}`);
}

function parseMinutes(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "arr") return 0;
  if (!normalized || normalized === "-" || normalized === "-1") return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function loadLevel(value: string | undefined): LoadLevel {
  switch (value?.trim().toLowerCase()) {
    case "low": return "seats";
    case "medium": return "standing";
    case "high": return "limited";
    case "full": return "full";
    default: return "unknown";
  }
}

function makeArrival(
  fallback: string | number | undefined,
  eta: NusShuttleEta | undefined,
  passengers: string | undefined,
): Arrival | null {
  const minutes = parseMinutes(eta?.eta ?? fallback);
  if (minutes === null) return null;
  return {
    minutes,
    estimatedAt: eta?.ts ?? null,
    load: loadLevel(passengers),
    wheelchair: null,
    vehicleType: "shuttle",
    monitored: true,
  };
}

export function normalizeNusStop(payload: NusShuttleServiceResponse): { stop: BusStop; updatedAt: string | null } {
  const result = payload.ShuttleServiceResult;
  if (!result || !Array.isArray(result.shuttles)) {
    throw new Error("NUS NextBus returned an invalid response");
  }

  return {
    updatedAt: result.TimeStamp ?? result.Timestamp ?? null,
    stop: {
      id: DEFAULT_STOP,
      name: result.caption ?? result.name ?? "University Town",
      kind: "nus",
      services: result.shuttles
        .filter((shuttle): shuttle is NusShuttle & { name: string } => Boolean(shuttle.name))
        .map((shuttle) => ({
          serviceNo: shuttle.name,
          arrivals: [
            makeArrival(shuttle.arrivalTime, shuttle._etas?.[0], shuttle.passengers),
            makeArrival(shuttle.nextArrivalTime, shuttle._etas?.[1], shuttle.nextPassengers),
          ].filter((arrival): arrival is Arrival => arrival !== null),
        })),
    },
  };
}

export async function fetchNusStop(): Promise<{ stop: BusStop; updatedAt: string | null }> {
  const provider = selectedProvider();
  const payload = provider === "nusbus"
    ? await fetchNusBusShuttleService(DEFAULT_STOP)
    : await fetchUnivusShuttleService(DEFAULT_STOP);
  return normalizeNusStop(payload as NusShuttleServiceResponse);
}
