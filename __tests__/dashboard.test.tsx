import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dashboard, mergeSnapshots } from "@/components/Dashboard";
import { DASHBOARD_CONFIG } from "@/lib/dashboard-config";
import type { ArrivalsResponse } from "@/lib/types";

const snapshot: ArrivalsResponse = {
  generatedAt: "2026-10-01T04:00:00.000Z",
  nus: { status: "ok", stale: false, updatedAt: "2026-10-01T04:00:00.000Z", stops: [{
    id: "UTOWN", name: "University Town", kind: "nus", services: [{ serviceNo: "D1", arrivals: [{ minutes: 2, estimatedAt: null, load: "seats", wheelchair: true, vehicleType: "shuttle", monitored: true, occupancyPercent: 20 }] }],
  }] },
  publicBus: { status: "ok", stale: false, updatedAt: "2026-10-01T04:00:00.000Z", stops: [
    { id: "19059", name: "UTown – RC4", kind: "public", services: [{ serviceNo: "196", arrivals: [{ minutes: 1, estimatedAt: null, load: "limited", wheelchair: true, vehicleType: "double", monitored: true }] }] },
    { id: "19051", name: "New Town Sec Sch", kind: "public", services: [] },
    { id: "17099", name: "UTown – Cendana", kind: "public", services: [] },
    { id: "17091", name: "Aft Clementi Ave 1", kind: "public", services: [] },
  ] },
};

describe("Dashboard", () => {
  it("renders all three configured stops", () => {
    render(<Dashboard initialData={snapshot} />);
    expect(screen.getByText("Upcoming RC4 events")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotating RC4 updates")).toBeInTheDocument();
    expect(screen.getByText("University Town")).toBeInTheDocument();
    expect(screen.getByText("UTown – RC4")).toBeInTheDocument();
    expect(screen.getByText("New Town Sec Sch")).toBeInTheDocument();
    expect(screen.getByLabelText("Bus D1")).toBeInTheDocument();
  });

  it("rotates between pages of public bus stops", () => {
    vi.useFakeTimers();
    try {
      const view = within(render(<Dashboard initialData={snapshot} />).container);
      const pageOf = (name: string) => view.getByText(name).closest(".public-page");
      expect(pageOf("UTown – RC4")).toHaveClass("is-active");
      expect(pageOf("New Town Sec Sch")).toHaveClass("is-active");
      expect(pageOf("UTown – Cendana")).not.toHaveClass("is-active");

      act(() => vi.advanceTimersByTime(DASHBOARD_CONFIG.publicStopsRotationMs));
      expect(pageOf("UTown – Cendana")).toHaveClass("is-active");
      expect(pageOf("Aft Clementi Ave 1")).toHaveClass("is-active");
      expect(pageOf("UTown – RC4")).not.toHaveClass("is-active");

      act(() => vi.advanceTimersByTime(DASHBOARD_CONFIG.publicStopsRotationMs));
      expect(pageOf("UTown – RC4")).toHaveClass("is-active");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps last successful data when one source fails", () => {
    const incoming: ArrivalsResponse = { ...snapshot, nus: { status: "error", stale: true, updatedAt: null, error: "down", stops: [] } };
    const merged = mergeSnapshots(snapshot, incoming);
    expect(merged.nus.stops[0].name).toBe("University Town");
    expect(merged.nus.stale).toBe(true);
    expect(merged.nus.error).toBe("down");
  });

  it("allows a publicity slide to be selected manually", () => {
    const view = render(<Dashboard initialData={snapshot} />);
    const dashboard = within(view.container);
    const deadlineButton = dashboard.getByRole("button", { name: "Show Sign-up deadlines" });
    fireEvent.click(deadlineButton);
    expect(dashboard.getByText("Sign-up deadlines")).toBeInTheDocument();
    expect(deadlineButton).toHaveAttribute("aria-pressed", "true");
  });
});
