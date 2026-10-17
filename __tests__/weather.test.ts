import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWeatherCache, getWeather, nearestReading, normalizeWeather, psiBand, type WeatherPayloads } from "@/lib/providers/weather";

const stations = [
  { id: "S50", location: { latitude: 1.3318, longitude: 103.7762 } },
  { id: "S116", location: { latitude: 1.2824, longitude: 103.7545 } },
  { id: "S24", location: { latitude: 1.3678, longitude: 103.9826 } },
];

const payloads: WeatherPayloads = {
  temperature: { data: { stations, readings: [{ data: [{ stationId: "S50", value: 30.6 }, { stationId: "S24", value: 28 }] }] } },
  twoHour: { data: { items: [{
    valid_period: { start: "2026-10-06T11:00:00+08:00", end: "2026-10-06T13:00:00+08:00" },
    forecasts: [{ area: "Bedok", forecast: "Fair (Day)" }, { area: "Clementi", forecast: "Partly Cloudy (Day)" }],
  }] } },
  day: { data: { records: [{
    periods: [
      { timePeriod: { start: "2026-10-06T06:00:00+08:00", end: "2026-10-06T12:00:00+08:00" }, regions: { west: { text: "Fair (Day)" } } },
      { timePeriod: { start: "2026-10-06T12:00:00+08:00", end: "2026-10-06T18:00:00+08:00" }, regions: { west: { text: "Thundery Showers" } } },
      { timePeriod: { start: "2026-10-06T18:00:00+08:00", end: "2026-10-07T06:00:00+08:00" }, regions: { west: { text: "Fair (Night)" } } },
    ],
  }] } },
  psi: { data: { items: [{ readings: { psi_twenty_four_hourly: { west: 113, central: 130 } } }] } },
};

describe("weather provider", () => {
  it("combines live readings, the area nowcast and the regional block for the next 5 hours", () => {
    const weather = normalizeWeather(payloads, new Date("2026-10-06T11:10:00+08:00"));

    expect(weather.temperature).toBe(30.6);
    expect(weather.next2h).toMatchObject({ condition: "Partly Cloudy (Day)", area: "Clementi" });
    expect(weather.later).toEqual({
      condition: "Thundery Showers",
      start: "2026-10-06T05:00:00.000Z",
      end: "2026-10-06T18:00:00+08:00",
    });
    expect(weather.psi).toEqual({ value: 113, band: "unhealthy", region: "west" });
  });

  it("picks the block covering most of the remaining window near a period boundary", () => {
    const weather = normalizeWeather(payloads, new Date("2026-10-06T16:30:00+08:00"));
    // Nowcast in the fixture has expired, so the window is 4:30pm–9:30pm; most of it is the night block.
    expect(weather.later?.condition).toBe("Fair (Night)");
    expect(weather.later?.start).toBe("2026-10-06T10:00:00.000Z");
  });

  it("uses the nearest station that actually reported", () => {
    expect(nearestReading({ data: { stations, readings: [{ data: [{ stationId: "S24", value: 1 }] }] } })).toBe(1);
    expect(nearestReading(undefined)).toBeNull();
  });

  it("degrades to empty fields when sources are missing", () => {
    const weather = normalizeWeather({}, new Date("2026-10-06T11:10:00+08:00"));
    expect(weather).toMatchObject({ temperature: null, next2h: null, later: null, psi: null });
  });

  it("maps PSI values to NEA bands", () => {
    expect([30, 51, 101, 201, 301].map(psiBand)).toEqual(["good", "moderate", "unhealthy", "very-unhealthy", "hazardous"]);
  });

  describe("getWeather", () => {
    const byPath: Record<string, unknown> = {
      "air-temperature": payloads.temperature,
      "two-hr-forecast": payloads.twoHour,
      "twenty-four-hr-forecast": payloads.day,
      psi: payloads.psi,
    };

    afterEach(() => {
      clearWeatherCache();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("caches feeds and falls back to the last good payload when NEA rate-limits", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      let limited = false;
      const fetchMock = vi.fn(async (url: string) => {
        if (limited) return new Response("", { status: 429 });
        return Response.json(byPath[url.split("/").pop()!]);
      });
      vi.stubGlobal("fetch", fetchMock);

      const first = await getWeather(new Date("2026-10-06T11:10:00+08:00"));
      expect(first).toMatchObject({ status: "ok", stale: false, temperature: 30.6 });
      expect(fetchMock).toHaveBeenCalledTimes(4);

      await getWeather(new Date("2026-10-06T11:12:00+08:00"));
      expect(fetchMock).toHaveBeenCalledTimes(4);

      limited = true;
      const fallback = await getWeather(new Date("2026-10-06T11:20:00+08:00"));
      expect(fetchMock).toHaveBeenCalledTimes(8);
      expect(fallback).toMatchObject({ status: "ok", stale: true, temperature: 30.6, psi: { value: 113 } });
    });

    it("reports an error when every feed fails with nothing cached", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
      expect(await getWeather(new Date("2026-10-06T11:10:00+08:00"))).toMatchObject({ status: "error", updatedAt: null });
    });
  });
});
