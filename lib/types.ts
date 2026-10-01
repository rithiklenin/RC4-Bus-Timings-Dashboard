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

export interface ArrivalsResponse {
  generatedAt: string;
  nus: SourceResult;
  publicBus: SourceResult;
}
