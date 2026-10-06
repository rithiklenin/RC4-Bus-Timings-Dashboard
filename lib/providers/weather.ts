import type { PsiBand, WeatherResponse } from "@/lib/types";

const NEA_BASE = "https://api-open.data.gov.sg/v2/real-time/api";

// Nearest stations are chosen at runtime because NEA stations occasionally drop out of a reading.
const RC4_LOCATION = { latitude: 1.3045, longitude: 103.7735 };
const FORECAST_AREA = "Clementi";
const FORECAST_REGION = "west";
const LOOKAHEAD_MS = 5 * 60 * 60 * 1000;

interface Station {
  id: string;
  location?: { latitude: number; longitude: number };
}

export interface StationReadingsPayload {
  data?: {
    stations?: Station[];
    readings?: { timestamp?: string; data?: { stationId: string; value: number }[] }[];
  };
}

export interface TwoHourPayload {
  data?: {
    items?: {
      update_timestamp?: string;
      valid_period?: { start: string; end: string };
      forecasts?: { area: string; forecast: string }[];
    }[];
  };
}

export interface DayPayload {
  data?: {
    records?: {
      periods?: {
        timePeriod: { start: string; end: string };
        regions: Record<string, { text: string } | undefined>;
      }[];
    }[];
  };
}

export interface PsiPayload {
  data?: {
    items?: { readings?: { psi_twenty_four_hourly?: Record<string, number> } }[];
  };
}

export interface WeatherPayloads {
  temperature?: StationReadingsPayload;
  twoHour?: TwoHourPayload;
  day?: DayPayload;
  psi?: PsiPayload;
}

function distance(station: Station) {
  if (!station.location) return Number.POSITIVE_INFINITY;
  return Math.hypot(station.location.latitude - RC4_LOCATION.latitude, station.location.longitude - RC4_LOCATION.longitude);
}

export function nearestReading(payload: StationReadingsPayload | undefined): number | null {
  const values = new Map((payload?.data?.readings?.[0]?.data ?? []).map((entry) => [entry.stationId, entry.value]));
  const station = [...(payload?.data?.stations ?? [])]
    .filter((candidate) => typeof values.get(candidate.id) === "number")
    .sort((a, b) => distance(a) - distance(b))[0];
  return station ? values.get(station.id)! : null;
}

export function psiBand(value: number): PsiBand {
  if (value <= 50) return "good";
  if (value <= 100) return "moderate";
  if (value <= 200) return "unhealthy";
  if (value <= 300) return "very-unhealthy";
  return "hazardous";
}

export function normalizeWeather(payloads: WeatherPayloads, now = new Date()): Omit<WeatherResponse, "generatedAt" | "status" | "stale" | "updatedAt" | "error"> {
  const twoHour = payloads.twoHour?.data?.items?.[0];
  const areaForecast = twoHour?.forecasts?.find((forecast) => forecast.area === FORECAST_AREA)?.forecast;
  const next2h = areaForecast && twoHour?.valid_period && Date.parse(twoHour.valid_period.end) > now.getTime()
    ? { condition: areaForecast, area: FORECAST_AREA, start: twoHour.valid_period.start, end: twoHour.valid_period.end }
    : null;

  // "Later" is the 6-hour regional block covering most of what the nowcast doesn't, up to 5 hours ahead.
  const record = payloads.day?.data?.records?.[0];
  const laterFrom = Math.max(now.getTime(), next2h ? Date.parse(next2h.end) : now.getTime());
  const horizon = now.getTime() + LOOKAHEAD_MS;
  const target = laterFrom < horizon ? (laterFrom + horizon) / 2 : laterFrom;
  const period = record?.periods?.find((entry) => Date.parse(entry.timePeriod.start) <= target && target < Date.parse(entry.timePeriod.end));
  const regionText = period?.regions[FORECAST_REGION]?.text;
  const later = period && regionText
    ? {
      condition: regionText,
      start: new Date(Math.max(laterFrom, Date.parse(period.timePeriod.start))).toISOString(),
      end: period.timePeriod.end,
    }
    : null;

  const psiValue = payloads.psi?.data?.items?.[0]?.readings?.psi_twenty_four_hourly?.[FORECAST_REGION];

  return {
    temperature: nearestReading(payloads.temperature),
    next2h,
    later,
    psi: typeof psiValue === "number" ? { value: psiValue, band: psiBand(psiValue), region: FORECAST_REGION } : null,
  };
}

// data.gov.sg rate-limits keyless requests aggressively, so each feed is cached in memory and the
// last good payload is reused when NEA rejects a refresh.
const CACHE_TTL_MS = 4 * 60 * 1000;
const MAX_FALLBACK_AGE_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { payload: unknown; fetchedAt: number }>();

async function fetchNea<T>(path: string): Promise<T> {
  const apiKey = process.env.DATA_GOV_SG_API_KEY;
  const response = await fetch(`${NEA_BASE}/${path}`, {
    headers: { accept: "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`NEA ${path} returned HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function fetchCached(path: string, now: number): Promise<{ payload: unknown; fallback: boolean }> {
  const cached = cache.get(path);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return { payload: cached.payload, fallback: false };
  try {
    const payload = await fetchNea(path);
    cache.set(path, { payload, fetchedAt: now });
    return { payload, fallback: false };
  } catch (error) {
    if (cached && now - cached.fetchedAt < MAX_FALLBACK_AGE_MS) return { payload: cached.payload, fallback: true };
    throw error;
  }
}

export function clearWeatherCache() {
  cache.clear();
}

const SOURCES = {
  temperature: "air-temperature",
  twoHour: "two-hr-forecast",
  day: "twenty-four-hr-forecast",
  psi: "psi",
} as const satisfies Record<keyof WeatherPayloads, string>;

export async function getWeather(now = new Date()): Promise<WeatherResponse> {
  const keys = Object.keys(SOURCES) as (keyof WeatherPayloads)[];
  const results = await Promise.allSettled(keys.map((key) => fetchCached(SOURCES[key], now.getTime())));

  const payloads: WeatherPayloads = {};
  const failures: string[] = [];
  let usedFallback = false;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      (payloads as Record<string, unknown>)[keys[index]] = result.value.payload;
      usedFallback ||= result.value.fallback;
    } else {
      failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  });
  if (failures.length) console.error("NEA weather partially unavailable", failures.join("; "));

  const base = { generatedAt: now.toISOString(), ...normalizeWeather(payloads, now) };
  if (failures.length === keys.length) {
    return { ...base, status: "error", stale: true, updatedAt: null, error: "Weather is temporarily unavailable" };
  }
  return { ...base, status: "ok", stale: failures.length > 0 || usedFallback, updatedAt: now.toISOString() };
}
