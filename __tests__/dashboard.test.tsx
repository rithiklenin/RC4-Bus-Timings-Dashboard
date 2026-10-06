import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard, mergeSnapshots } from "@/components/Dashboard";
import { DASHBOARD_CONFIG } from "@/lib/dashboard-config";
import type { ArrivalsResponse, WeatherResponse } from "@/lib/types";

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

const weather: WeatherResponse = {
  generatedAt: "2026-10-06T03:10:00.000Z",
  status: "ok",
  stale: false,
  updatedAt: "2026-10-06T03:10:00.000Z",
  temperature: 30.6,
  next2h: { condition: "Partly Cloudy (Day)", area: "Clementi", start: "2026-10-06T11:00:00+08:00", end: "2026-10-06T13:00:00+08:00" },
  later: { condition: "Thundery Showers", start: "2026-10-06T05:00:00.000Z", end: "2026-10-06T18:00:00+08:00" },
  psi: { value: 113, band: "unhealthy", region: "west" },
};

describe("Dashboard", () => {
  beforeEach(() => {
    // Weather is fetched on mount when no initial forecast is given; keep tests off the network.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  });

  it("renders the NUS stop and the first public stop", () => {
    render(<Dashboard initialData={snapshot} />);
    expect(screen.getByText("Upcoming RC4 events")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotating RC4 updates")).toBeInTheDocument();
    expect(screen.getByText("University Town")).toBeInTheDocument();
    expect(screen.getByText("UTown – RC4")).toBeInTheDocument();
    expect(screen.queryByText("New Town Sec Sch")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Bus D1")).toBeInTheDocument();
  });

  it("rotates between public stops in a single panel", () => {
    vi.useFakeTimers();
    try {
      const view = within(render(<Dashboard initialData={snapshot} />).container);
      expect(view.getByText("UTown – RC4")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(DASHBOARD_CONFIG.publicStopRotationMs));
      expect(view.getByText("New Town Sec Sch")).toBeInTheDocument();
      expect(view.queryByText("UTown – RC4")).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(DASHBOARD_CONFIG.publicStopRotationMs));
      expect(view.getByText("UTown – RC4")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rotates the dining menu two cuisines at a time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00+08:00"));
    try {
      const menu = within(within(render(<Dashboard initialData={snapshot} />).container).getByLabelText("Dining hall menu"));
      expect(menu.getByText("Dining hall · dinner")).toBeInTheDocument();
      expect(menu.getByText("Malay")).toBeInTheDocument();
      expect(menu.getByText("Western")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(DASHBOARD_CONFIG.diningRotationMs));
      expect(menu.getByText("Indian")).toBeInTheDocument();
      expect(menu.getByText("Indian Vegetarian")).toBeInTheDocument();
      expect(menu.queryByText("Malay")).not.toBeInTheDocument();
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

  it("shows current weather, the next ~5 hours and PSI", () => {
    const strip = within(within(render(<Dashboard initialData={snapshot} initialWeather={weather} />).container).getByLabelText("Weather"));
    expect(strip.getByText("31°")).toBeInTheDocument();
    expect(strip.getByText("Until 1pm")).toBeInTheDocument();
    expect(strip.getByText("From 1pm")).toBeInTheDocument();
    expect(strip.getByText("Thundery Showers")).toBeInTheDocument();
    expect(strip.getByText("113")).toBeInTheDocument();
    expect(strip.getByText("Unhealthy")).toBeInTheDocument();
  });

});
