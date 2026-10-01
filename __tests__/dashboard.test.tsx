import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard, mergeSnapshots } from "@/components/Dashboard";
import type { ArrivalsResponse } from "@/lib/types";

const snapshot: ArrivalsResponse = {
  generatedAt: "2026-10-01T04:00:00.000Z",
  nus: { status: "ok", stale: false, updatedAt: "2026-10-01T04:00:00.000Z", stops: [{
    id: "UTOWN", name: "University Town", kind: "nus", services: [{ serviceNo: "D1", arrivals: [{ minutes: 2, estimatedAt: null, load: "seats", wheelchair: true, vehicleType: "shuttle", monitored: true, occupancyPercent: 20 }] }],
  }] },
  publicBus: { status: "ok", stale: false, updatedAt: "2026-10-01T04:00:00.000Z", stops: [
    { id: "19059", name: "UTown – RC4", kind: "public", services: [{ serviceNo: "196", arrivals: [{ minutes: 1, estimatedAt: null, load: "limited", wheelchair: true, vehicleType: "double", monitored: true }] }] },
    { id: "19051", name: "New Town Sec Sch", kind: "public", services: [] },
  ] },
};

describe("Dashboard", () => {
  it("renders all three configured stops", () => {
    render(<Dashboard initialData={snapshot} />);
    expect(screen.getByText("University Town")).toBeInTheDocument();
    expect(screen.getByText("UTown – RC4")).toBeInTheDocument();
    expect(screen.getByText("New Town Sec Sch")).toBeInTheDocument();
    expect(screen.getByLabelText("Bus D1")).toBeInTheDocument();
  });

  it("keeps last successful data when one source fails", () => {
    const incoming: ArrivalsResponse = { ...snapshot, nus: { status: "error", stale: true, updatedAt: null, error: "down", stops: [] } };
    const merged = mergeSnapshots(snapshot, incoming);
    expect(merged.nus.stops[0].name).toBe("University Town");
    expect(merged.nus.stale).toBe(true);
    expect(merged.nus.error).toBe("down");
  });
});
