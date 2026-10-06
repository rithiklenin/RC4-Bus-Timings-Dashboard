import type { Arrival, BusService, BusStop, LoadLevel, VehicleType } from "@/lib/types";

const LTA_URL = "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival";

export const PUBLIC_STOPS = [
  { id: "19059", name: "UTown – RC4" },
  { id: "19051", name: "New Town Sec Sch" },
] as const;

interface LtaBus {
  EstimatedArrival?: string;
  Load?: string;
  Feature?: string;
  Type?: string;
  Monitored?: number;
}

interface LtaService {
  ServiceNo?: string;
  NextBus?: LtaBus;
  NextBus2?: LtaBus;
  NextBus3?: LtaBus;
}

interface LtaResponse {
  Services?: LtaService[];
}

function loadLevel(value?: string): LoadLevel {
  return ({ SEA: "seats", SDA: "standing", LSD: "limited" } as const)[value ?? ""] ?? "unknown";
}

function vehicleType(value?: string): VehicleType {
  return ({ SD: "single", DD: "double", BD: "bendy" } as const)[value ?? ""] ?? "unknown";
}

function minutesUntil(value: string | undefined, now: Date): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - now.getTime()) / 60_000));
}

function normalizeBus(bus: LtaBus | undefined, now: Date): Arrival | null {
  const minutes = minutesUntil(bus?.EstimatedArrival, now);
  if (!bus?.EstimatedArrival || minutes === null) return null;
  return {
    minutes,
    estimatedAt: bus.EstimatedArrival,
    load: loadLevel(bus.Load),
    wheelchair: bus.Feature ? bus.Feature === "WAB" : null,
    vehicleType: vehicleType(bus.Type),
    monitored: typeof bus.Monitored === "number" ? bus.Monitored === 1 : null,
  };
}

export function normalizeLtaStop(
  stop: (typeof PUBLIC_STOPS)[number],
  payload: LtaResponse,
  now = new Date(),
): BusStop {
  const services: BusService[] = (payload.Services ?? [])
    .filter((service): service is LtaService & { ServiceNo: string } => Boolean(service.ServiceNo))
    .map((service) => ({
      serviceNo: service.ServiceNo,
      arrivals: [service.NextBus, service.NextBus2, service.NextBus3]
        .map((bus) => normalizeBus(bus, now))
        .filter((arrival): arrival is Arrival => arrival !== null),
    }))
    .sort((a, b) => a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true }));

  return { id: stop.id, name: stop.name, kind: "public", services };
}

export async function fetchPublicBusStops(now = new Date()): Promise<BusStop[]> {
  const accountKey = process.env.LTA_ACCOUNT_KEY;
  if (!accountKey) throw new Error("LTA AccountKey is not configured");

  return Promise.all(
    PUBLIC_STOPS.map(async (stop) => {
      const response = await fetch(`${LTA_URL}?BusStopCode=${stop.id}`, {
        headers: { AccountKey: accountKey, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`LTA ${stop.id} returned HTTP ${response.status}`);
      return normalizeLtaStop(stop, (await response.json()) as LtaResponse, now);
    }),
  );
}
