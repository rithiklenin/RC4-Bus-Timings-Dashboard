import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicBusStops, normalizeLtaStop, PUBLIC_STOPS } from "@/lib/providers/lta";
import { fetchNusStop, normalizeNusStop } from "@/lib/providers/nus";

afterEach(() => {
  delete process.env.LTA_ACCOUNT_KEY;
  delete process.env.NUS_PROXY_BASE_URLS;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LTA provider", () => {
  it("normalizes and sorts services with arrival metadata", () => {
    const now = new Date("2026-10-01T04:00:00.000Z");
    const stop = normalizeLtaStop(PUBLIC_STOPS[0], { Services: [
      { ServiceNo: "196", NextBus: { EstimatedArrival: "2026-10-01T12:05:01+08:00", Load: "SDA", Feature: "WAB", Type: "DD", Monitored: 1 } },
      { ServiceNo: "33", NextBus: { EstimatedArrival: "2026-10-01T12:00:20+08:00", Load: "SEA", Type: "SD", Monitored: 0 }, NextBus2: {} },
    ] }, now);

    expect(stop.id).toBe("19059");
    expect(stop.services.map((service) => service.serviceNo)).toEqual(["33", "196"]);
    expect(stop.services[0].arrivals[0]).toMatchObject({ minutes: 1, load: "seats", vehicleType: "single", monitored: false });
    expect(stop.services[1].arrivals[0]).toMatchObject({ minutes: 6, load: "standing", wheelchair: true, vehicleType: "double" });
  });

  it("keeps an available stop when another LTA stop fails", async () => {
    process.env.LTA_ACCOUNT_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("19059")) return Promise.resolve(new Response("upstream error", { status: 502 }));
      return Promise.resolve(new Response(JSON.stringify({ Services: [] }), { status: 200 }));
    }));

    const stops = await fetchPublicBusStops(new Date("2026-10-01T04:00:00.000Z"));
    expect(stops.map((stop) => stop.id)).toEqual(["19051"]);
  });
});

describe("NUS provider", () => {
  it("normalizes arrivals and calculates occupancy", () => {
    const result = normalizeNusStop({ etas: {
      lastUpdated: "2026-10-01T12:00:00+08:00",
      busStopName: "UTOWN",
      busStopCaption: "University Town",
      timings: [{ name: "D1", arrivalTime: "Arr", nextArrivalTime: "8", arrivalTime_capacity: 88, arrivalTime_ridership: 86 }],
    } });

    expect(result.stop.services[0].arrivals[0]).toMatchObject({ minutes: 0, occupancyPercent: 98, load: "full" });
    expect(result.stop.services[0].arrivals[1].minutes).toBe(8);
  });

  it("rejects malformed responses", () => {
    expect(() => normalizeNusStop({})).toThrow("invalid response");
  });

  it("falls back to the next configured NUS provider", async () => {
    process.env.NUS_PROXY_BASE_URLS = "https://first.example, https://second.example";
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).startsWith("https://first.example")) {
        return Promise.resolve(new Response(JSON.stringify({ message: "unavailable" }), { status: 502 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ etas: {
        busStopName: "UTOWN",
        busStopCaption: "University Town",
        timings: [{ name: "D1", arrivalTime: "3" }],
      } }), { status: 200 }));
    }));

    const result = await fetchNusStop();
    expect(result.stop.name).toBe("University Town");
    expect(result.stop.services[0].arrivals[0].minutes).toBe(3);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
