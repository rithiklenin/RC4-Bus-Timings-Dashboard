import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicBusStops, normalizeLtaStop, PUBLIC_STOPS } from "@/lib/providers/lta";
import { fetchNusStop, normalizeNusStop } from "@/lib/providers/nus";

afterEach(() => {
  delete process.env.LTA_ACCOUNT_KEY;
  delete process.env.NUS_BUS_PROVIDER;
  delete process.env.NUSBUS_BASE_URL;
  delete process.env.UNIVUS_AUTH_BASE_URL;
  delete process.env.UNIVUS_BUS_PROXY_BASE_URL;
  delete process.env.UNIVUS_HTD_API_KEY;
  delete process.env.UNIVUS_APP_API_KEY;
  delete process.env.UNIVUS_BUS_PROXY_API_KEY;
  delete process.env.UNIVUS_DEVICE_ID;
  delete process.env.UNIVUS_APP_VERSION;
  delete process.env.UNIVUS_IP_ADDRESS;
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
  it("normalizes official NextBus arrivals and passenger loads", () => {
    const result = normalizeNusStop({ ShuttleServiceResult: {
      TimeStamp: "2026-10-01T12:00:00+08:00",
      name: "UTOWN",
      caption: "University Town",
      shuttles: [{
        name: "D1",
        arrivalTime: "Arr",
        nextArrivalTime: "8",
        passengers: "High",
        nextPassengers: "Low",
        _etas: [{ eta: 0, ts: "2026-10-01 12:00:00" }, { eta: 8, ts: "2026-10-01 12:08:00" }],
      }],
    } });

    expect(result.updatedAt).toBe("2026-10-01T12:00:00+08:00");
    expect(result.stop.services[0].arrivals[0]).toMatchObject({ minutes: 0, load: "limited" });
    expect(result.stop.services[0].arrivals[1]).toMatchObject({ minutes: 8, load: "seats" });
  });

  it("rejects malformed responses", () => {
    expect(() => normalizeNusStop({})).toThrow("invalid response");
  });

  it("uses the nusbus.app provider by default", async () => {
    process.env.NUSBUS_BASE_URL = "https://nusbus.example/api/";
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://nusbus.example/api/shuttle-service?busstopname=UTOWN");
      expect(init?.headers).toMatchObject({ Accept: "application/json" });
      return Promise.resolve(Response.json({ ShuttleServiceResult: {
        name: "UTOWN",
        caption: "University Town",
        shuttles: [{ name: "D1", arrivalTime: "3", nextArrivalTime: "-" }],
      } }));
    }));

    const result = await fetchNusStop();
    expect(result.stop.name).toBe("University Town");
    expect(result.stop.services[0].arrivals[0].minutes).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("can switch to the direct uNivUS inetapps provider", async () => {
    process.env.NUS_BUS_PROVIDER = "univus";
    process.env.UNIVUS_AUTH_BASE_URL = "https://auth.example";
    process.env.UNIVUS_BUS_PROXY_BASE_URL = "https://inetapps.example/univus/api/bus-proxy";
    process.env.UNIVUS_HTD_API_KEY = "htd-key";
    process.env.UNIVUS_APP_API_KEY = "app-key";
    process.env.UNIVUS_BUS_PROXY_API_KEY = "proxy-key";
    process.env.UNIVUS_DEVICE_ID = "11111111-1111-4111-8111-111111111111";
    const jwt = `header.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString("base64url")}.signature`;

    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/univus-public/mobile/get-access-token")) {
        expect(init?.headers).toMatchObject({ "X-HTD-API": "htd-key", "X-APP-API": "app-key" });
        return Promise.resolve(Response.json({
          code: "00000",
          data: { token: jwt, userid: "public-user", domain: "PUBLIC" },
        }));
      }

      expect(url).toBe("https://inetapps.example/univus/api/bus-proxy/shuttle-service");
      expect(init?.headers).toMatchObject({
        "x-api-key": "proxy-key",
        Authorization: `Bearer ${jwt}`,
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        token: jwt,
        userid: "public-user",
        domain: "PUBLIC",
        deviceid: "11111111-1111-4111-8111-111111111111",
        busstopname: "UTOWN",
      });
      return Promise.resolve(Response.json({
        code: "00000",
        data: { ShuttleServiceResult: {
          name: "UTOWN",
          caption: "University Town",
          shuttles: [{ name: "D1", arrivalTime: "3", nextArrivalTime: "-" }],
        } },
      }));
    }));

    const result = await fetchNusStop();
    expect(result.stop.name).toBe("University Town");
    expect(result.stop.services[0].arrivals[0].minutes).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported provider names", async () => {
    process.env.NUS_BUS_PROVIDER = "unknown";
    await expect(fetchNusStop()).rejects.toThrow("Unsupported NUS_BUS_PROVIDER: unknown");
  });
});
