import { describe, expect, it } from "vitest";
import { normalizeLtaStop, PUBLIC_STOPS } from "@/lib/providers/lta";
import { normalizeNusStop } from "@/lib/providers/nus";

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
});
