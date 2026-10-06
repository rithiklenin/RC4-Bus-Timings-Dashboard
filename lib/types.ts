export type SourceStatus = "ok" | "error";
export type LoadLevel = "seats" | "standing" | "limited" | "full" | "unknown";
export type VehicleType = "single" | "double" | "bendy" | "shuttle" | "unknown";

export interface Arrival {
  minutes: number | null;
  estimatedAt: string | null;
  load: LoadLevel;
  wheelchair: boolean | null;
  vehicleType: VehicleType;
  monitored: boolean | null;
  occupancyPercent?: number;
}

export interface BusService {
  serviceNo: string;
  arrivals: Arrival[];
}

export interface BusStop {
  id: string;
  name: string;
  kind: "nus" | "public";
  services: BusService[];
}

export interface SourceResult {
  status: SourceStatus;
  stale: boolean;
  updatedAt: string | null;
  error?: string;
  stops: BusStop[];
}

export type PsiBand = "good" | "moderate" | "unhealthy" | "very-unhealthy" | "hazardous";

export interface WeatherResponse {
  generatedAt: string;
  status: SourceStatus;
  stale: boolean;
  updatedAt: string | null;
  error?: string;
  temperature: number | null;
  next2h: { condition: string; area: string; start: string; end: string } | null;
  later: { condition: string; start: string; end: string } | null;
  psi: { value: number; band: PsiBand; region: string } | null;
}

export interface ArrivalsResponse {
  generatedAt: string;
  nus: SourceResult;
  publicBus: SourceResult;
}
