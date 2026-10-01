import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusStop } from "@/lib/types";

vi.mock("@/lib/providers/lta", () => ({ fetchPublicBusStops: vi.fn() }));
vi.mock("@/lib/providers/nus", () => ({ fetchNusStop: vi.fn() }));

import { fetchPublicBusStops } from "@/lib/providers/lta";
import { fetchNusStop } from "@/lib/providers/nus";
import { getArrivals } from "@/lib/providers/aggregate";

const nusStop: BusStop = { id: "UTOWN", name: "University Town", kind: "nus", services: [] };
const publicStop: BusStop = { id: "19059", name: "UTown – RC4", kind: "public", services: [] };

describe("arrival aggregation", () => {
  beforeEach(() => {
    vi.mocked(fetchNusStop).mockReset();
    vi.mocked(fetchPublicBusStops).mockReset();
  });

  it("returns both sources independently", async () => {
    vi.mocked(fetchNusStop).mockResolvedValue({ stop: nusStop, updatedAt: "2026-10-01T11:59:30+08:00" });
    vi.mocked(fetchPublicBusStops).mockResolvedValue([publicStop]);
    const result = await getArrivals(new Date("2026-10-01T04:00:00.000Z"));
    expect(result.nus.status).toBe("ok");
    expect(result.nus.stale).toBe(false);
    expect(result.publicBus.stops).toEqual([publicStop]);
  });

  it("preserves NUS results when LTA fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetchNusStop).mockResolvedValue({ stop: nusStop, updatedAt: "2026-10-01T12:00:00+08:00" });
    vi.mocked(fetchPublicBusStops).mockRejectedValue(new Error("bad key"));
    const result = await getArrivals(new Date("2026-10-01T04:00:00.000Z"));
    expect(result.nus.stops).toHaveLength(1);
    expect(result.publicBus).toMatchObject({ status: "error", stale: true, stops: [] });
  });

  it("marks an old NUS update as stale", async () => {
    vi.mocked(fetchNusStop).mockResolvedValue({ stop: nusStop, updatedAt: "2026-10-01T11:55:00+08:00" });
    vi.mocked(fetchPublicBusStops).mockResolvedValue([publicStop]);
    const result = await getArrivals(new Date("2026-10-01T04:00:00.000Z"));
    expect(result.nus.stale).toBe(true);
  });
});
