"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DASHBOARD_CONFIG } from "@/lib/dashboard-config";
import { DINING_PAGES, getCurrentMeal } from "@/lib/dining";
import type { Arrival, ArrivalsResponse, BusService, BusStop, PsiBand, SourceResult, WeatherResponse } from "@/lib/types";

const PUBLICITY_ITEMS = [
  {
    eyebrow: "CSC publicity",
    title: "Upcoming RC4 events",
    description: "A rotating space for committee posters, event details and venue information.",
    note: "Designed for content supplied by CSC",
  },
  {
    eyebrow: "Time-sensitive",
    title: "Sign-up deadlines",
    description: "Important registration windows stay visible without crowding the live transport panel.",
    note: "Expired notices can be removed automatically",
  },
  {
    eyebrow: "College updates",
    title: "Selected RC4 announcements",
    description: "A focused channel for relevant notices, reminders and community opportunities.",
    note: "Curated for quick-glance viewing",
  },
] as const;

function mergeSource(previous: SourceResult | undefined, incoming: SourceResult): SourceResult {
  if (incoming.status === "ok" || !previous?.stops.length) return incoming;
  return {
    ...previous,
    status: "error",
    stale: true,
    error: incoming.error,
  };
}

export function mergeSnapshots(previous: ArrivalsResponse | null, incoming: ArrivalsResponse): ArrivalsResponse {
  if (!previous) return incoming;
  return {
    generatedAt: incoming.generatedAt,
    nus: mergeSource(previous.nus, incoming.nus),
    publicBus: mergeSource(previous.publicBus, incoming.publicBus),
  };
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatUpdated(value: string | null) {
  if (!value) return "Waiting for data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)}`;
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(value))
    .replace(":00", "")
    .replace(/\s/g, "")
    .toLowerCase();
}

// NEA forecasts are free text ("Thundery Showers", "Partly Cloudy (Night)"), so match on keywords.
export function weatherIcon(condition: string | null | undefined) {
  const text = condition?.toLowerCase() ?? "";
  if (text.includes("thunder")) return "⛈";
  if (text.includes("shower") || text.includes("rain") || text.includes("drizzle")) return "🌧";
  if (text.includes("haz") || text.includes("mist") || text.includes("fog")) return "🌫";
  if (text.includes("wind")) return "💨";
  if (text.includes("partly cloudy")) return text.includes("night") ? "☁" : "⛅";
  if (text.includes("cloud") || text.includes("overcast")) return "☁";
  if (text.includes("night")) return "🌙";
  if (text.includes("fair") || text.includes("sunny") || text.includes("warm")) return "☀";
  return "🌡";
}

// Strips NEA's "(Day)"/"(Night)" suffix, which the icon already conveys.
function conditionLabel(condition: string) {
  return condition.replace(/\s*\((day|night)\)/i, "");
}

const PSI_LABELS: Record<PsiBand, string> = {
  good: "Good",
  moderate: "Moderate",
  unhealthy: "Unhealthy",
  "very-unhealthy": "Very unhealthy",
  hazardous: "Hazardous",
};

function WeatherStrip({ weather }: { weather: WeatherResponse | null }) {
  if (!weather || weather.status === "error") {
    return (
      <section className="weather-strip weather-empty" aria-label="Weather">
        <span>{weather ? "Weather unavailable" : "Loading weather…"}</span>
      </section>
    );
  }

  const { temperature, next2h, later, psi } = weather;

  return (
    <section className={`weather-strip ${weather.stale ? "weather-stale" : ""}`} aria-label="Weather">
      <div className="weather-now">
        <strong>{temperature !== null ? `${Math.round(temperature)}°` : "–"}</strong>
      </div>
      {next2h && (
        <div className="weather-slot">
          <span className="weather-slot-label">Until {formatHour(next2h.end)}</span>
          <span className="weather-slot-body"><i aria-hidden="true">{weatherIcon(next2h.condition)}</i>{conditionLabel(next2h.condition)}</span>
        </div>
      )}
      {later && (
        <div className="weather-slot">
          <span className="weather-slot-label">From {formatHour(later.start)}</span>
          <span className="weather-slot-body"><i aria-hidden="true">{weatherIcon(later.condition)}</i>{conditionLabel(later.condition)}</span>
        </div>
      )}
      {psi && (
        <div className={`psi-badge psi-${psi.band}`} title={`24-hr PSI (${psi.region})`}>
          <span>PSI</span>
          <strong>{psi.value}</strong>
          <span>{PSI_LABELS[psi.band]}</span>
        </div>
      )}
    </section>
  );
}

function loadLabel(arrival: Arrival) {
  if (arrival.occupancyPercent !== undefined) return `${arrival.occupancyPercent}% full`;
  return ({ seats: "Seats available", standing: "Standing", limited: "Limited", full: "Full", unknown: "Live bus" } as const)[arrival.load];
}

function ArrivalTime({ arrival, primary = false }: { arrival: Arrival; primary?: boolean }) {
  const imminent = arrival.minutes !== null && arrival.minutes <= 1;
  return (
    <div className={`arrival ${primary ? "arrival-primary" : ""} ${imminent ? "arrival-imminent" : ""}`}>
      <strong>{imminent ? "Arr" : arrival.minutes ?? "–"}</strong>
      {!imminent && arrival.minutes !== null && <span>min</span>}
    </div>
  );
}

function ServiceRow({ service, compact = false }: { service: BusService; compact?: boolean }) {
  const first = service.arrivals[0];
  return (
    <div className={`service-row ${compact ? "service-row-compact" : ""}`}>
      <div className="service-badge" aria-label={`Bus ${service.serviceNo}`}>{service.serviceNo}</div>
      <div className="arrival-list">
        {service.arrivals.length ? service.arrivals.map((arrival, index) => (
          <ArrivalTime key={`${arrival.estimatedAt}-${index}`} arrival={arrival} primary={index === 0} />
        )) : <span className="no-arrivals">No upcoming buses</span>}
      </div>
      {first && (
        <div className="load-block" title={loadLabel(first)}>
          <span className={`load-dot load-${first.load}`} />
          <span>{loadLabel(first)}</span>
          {first.occupancyPercent !== undefined && (
            <span className="occupancy-track" aria-hidden="true">
              <span style={{ width: `${first.occupancyPercent}%` }} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SourceMeta({ source, label }: { source: SourceResult; label: string }) {
  const healthy = source.status === "ok" && !source.stale;
  return (
    <div className={`source-meta ${healthy ? "source-live" : "source-stale"}`}>
      <span className="status-dot" />
      <span>{healthy ? `${label} live` : `${label} delayed`}</span>
      <span className="meta-divider">·</span>
      <span>{formatUpdated(source.updatedAt)}</span>
    </div>
  );
}

function StopPanel({ stop, source, featured = false }: { stop: BusStop; source: SourceResult; featured?: boolean }) {
  return (
    <section className={`stop-panel ${featured ? "stop-featured" : "stop-secondary"}`}>
      <header className="stop-header">
        <div>
          <div className="eyebrow">{stop.kind === "nus" ? "NUS internal shuttle" : `Public bus · Stop ${stop.id}`}</div>
          <h2>{stop.name}</h2>
        </div>
        <div className={`mode-icon ${stop.kind}`} aria-hidden="true">
          <span />
          <i /><i />
        </div>
      </header>
      <div className="service-labels" aria-hidden="true">
        <span>Service</span><span>Next arrivals</span><span>Capacity</span>
      </div>
      <div className="services">
        {stop.services.length ? stop.services.map((service) => (
          <ServiceRow key={service.serviceNo} service={service} compact={!featured} />
        )) : (
          <div className="empty-state">No upcoming services at this stop</div>
        )}
      </div>
      <SourceMeta source={source} label={stop.kind === "nus" ? "NUS" : "LTA"} />
      {source.stale && source.error && <div className="inline-warning">Showing the last available timings</div>}
    </section>
  );
}

function SkeletonPanel({ featured = false }: { featured?: boolean }) {
  return (
    <section className={`stop-panel skeleton-panel ${featured ? "stop-featured" : "stop-secondary"}`} aria-label="Loading bus timings">
      <div className="skeleton skeleton-title" />
      {[1, 2, 3].map((item) => <div className="skeleton skeleton-row" key={item} />)}
    </section>
  );
}

function ErrorPanel({ title, error, featured = false }: { title: string; error?: string; featured?: boolean }) {
  return (
    <section className={`stop-panel error-panel ${featured ? "stop-featured" : "stop-secondary"}`}>
      <div className="error-symbol">!</div>
      <h2>{title}</h2>
      <p>{error ?? "Timings are temporarily unavailable"}</p>
      <span>Retrying automatically</span>
    </section>
  );
}

function PublicityPanel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % PUBLICITY_ITEMS.length);
    }, DASHBOARD_CONFIG.publicityRotationMs);
    return () => window.clearInterval(rotation);
  }, []);

  const item = PUBLICITY_ITEMS[activeIndex];

  return (
    <section className="publicity-panel" aria-label="Rotating RC4 updates" aria-live="polite">
      <div className="publicity-copy" key={item.title}>
        <div className="eyebrow">{item.eyebrow}</div>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        <span className="publicity-note">{item.note}</span>
      </div>
      <div className="publicity-meta">
        <span>RC4 highlights</span>
        <div className="publicity-dots" aria-label="Select RC4 highlight">
          {PUBLICITY_ITEMS.map((entry, index) => (
            <button
              type="button"
              className={index === activeIndex ? "active" : ""}
              aria-label={`Show ${entry.title}`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              key={entry.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PublicStopRotator({ stops, source }: { stops: BusStop[]; source: SourceResult }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (stops.length < 2) return;
    const rotation = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % stops.length);
    }, DASHBOARD_CONFIG.publicStopRotationMs);
    return () => window.clearInterval(rotation);
  }, [stops.length]);

  const stop = stops[activeIndex % stops.length];

  return (
    <div className="stop-rotator" key={stop.id}>
      <StopPanel stop={stop} source={source} />
    </div>
  );
}

function DiningPanel({ now }: { now: Date }) {
  const { meal, serviceDate, nextSwitch } = getCurrentMeal(now);
  const pages = DINING_PAGES[meal];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setActiveIndex((current) => current + 1);
    }, DASHBOARD_CONFIG.diningRotationMs);
    return () => window.clearInterval(rotation);
  }, []);

  const pageIndex = activeIndex % pages.length;
  const otherMeal = meal === "dinner" ? "breakfast" : "dinner";

  return (
    <section className="stop-panel stop-secondary dining-panel" aria-label="Dining hall menu">
      <header className="stop-header">
        <div>
          <div className="eyebrow">Dining hall · {meal}</div>
          <h2>{formatDate(serviceDate)}</h2>
        </div>
        <div className="dining-dots" aria-hidden="true">
          {pages.map((page, index) => <span className={index === pageIndex ? "active" : ""} key={page[0].name} />)}
        </div>
      </header>
      <div className="dining-page" key={`${meal}-${pageIndex}`}>
        {pages[pageIndex].map((cuisine) => (
          <div className="cuisine" key={cuisine.name}>
            <h3>{cuisine.name}{cuisine.vegetarian && <span className="veg-tag">Veg</span>}</h3>
            <ul className="dish-list">
              {cuisine.dishes.map((dish) => <li key={dish}>{dish}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="source-meta source-stale">
        <span className="status-dot" />
        <span>Sample menu</span>
        <span className="meta-divider">·</span>
        <span>Switches to {otherMeal} at {nextSwitch}</span>
      </div>
    </section>
  );
}

export function Dashboard({ initialData = null, initialWeather = null }: { initialData?: ArrivalsResponse | null; initialWeather?: WeatherResponse | null }) {
  const [data, setData] = useState<ArrivalsResponse | null>(initialData);
  const [weather, setWeather] = useState<WeatherResponse | null>(initialWeather);
  const [now, setNow] = useState(() => new Date());
  const requestActive = useRef(false);

  const refresh = useCallback(async () => {
    if (requestActive.current) return;
    requestActive.current = true;
    try {
      const response = await fetch("/api/arrivals", { cache: "no-store" });
      if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
      const incoming = await response.json() as ArrivalsResponse;
      setData((previous) => mergeSnapshots(previous, incoming));
    } catch (error) {
      console.error("Unable to refresh arrivals", error instanceof Error ? error.message : error);
      setData((previous) => previous ? {
        ...previous,
        nus: { ...previous.nus, status: "error", stale: true, error: "Refresh failed" },
        publicBus: { ...previous.publicBus, status: "error", stale: true, error: "Refresh failed" },
      } : previous);
    } finally {
      requestActive.current = false;
    }
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    const initialRefresh = !initialData ? window.setTimeout(() => void refresh(), 0) : undefined;
    const polling = window.setInterval(() => void refresh(), DASHBOARD_CONFIG.arrivalsRefreshMs);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(polling);
      if (initialRefresh !== undefined) window.clearTimeout(initialRefresh);
    };
  }, [initialData, refresh]);

  useEffect(() => {
    const refreshWeather = async () => {
      try {
        const response = await fetch("/api/weather", { cache: "no-store" });
        if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
        const incoming = await response.json() as WeatherResponse;
        // Keep the last good forecast on screen if NEA is down.
        setWeather((previous) => incoming.status === "error" && previous?.status === "ok" ? { ...previous, stale: true } : incoming);
      } catch (error) {
        console.error("Unable to refresh weather", error instanceof Error ? error.message : error);
        setWeather((previous) => previous ? { ...previous, stale: true } : previous);
      }
    };
    const initialRefresh = !initialWeather ? window.setTimeout(() => void refreshWeather(), 0) : undefined;
    const polling = window.setInterval(() => void refreshWeather(), DASHBOARD_CONFIG.weatherRefreshMs);
    return () => {
      window.clearInterval(polling);
      if (initialRefresh !== undefined) window.clearTimeout(initialRefresh);
    };
  }, [initialWeather]);

  const publicStops = useMemo(() => {
    const stops = data?.publicBus.stops ?? [];
    return ["19059", "19051"].map((id) => stops.find((stop) => stop.id === id)).filter((stop): stop is BusStop => Boolean(stop));
  }, [data]);
  const nusStop = data?.nus.stops[0];

  return (
    <main className="dashboard-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">RC<span>4</span></div>
          <div><h1>Bus Board</h1><p>Residential College 4</p></div>
        </div>
        <div className="topbar-right">
          <WeatherStrip weather={weather} />
          <div className="clock">
            <strong suppressHydrationWarning>{formatClock(now)}</strong>
            <span suppressHydrationWarning>{formatDate(now)} · SGT</span>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="main-column">
          <PublicityPanel />
          {nusStop && data ? <StopPanel stop={nusStop} source={data.nus} />
            : data?.nus.status === "error" ? <ErrorPanel title="University Town" error={data.nus.error} />
            : <SkeletonPanel />}
        </div>

        <div className="public-column">
          <div className="column-heading"><span>Nearby public buses</span><i /></div>
          {publicStops.length && data ? <PublicStopRotator stops={publicStops} source={data.publicBus} />
            : data?.publicBus.status === "error" ? <ErrorPanel title="Public bus timings" error={data.publicBus.error} />
            : <SkeletonPanel />}
          <DiningPanel now={now} />
        </div>
      </div>

      <footer>
        <span><i className="legend-dot green" /> Seats</span>
        <span><i className="legend-dot amber" /> Standing</span>
        <span><i className="legend-dot red" /> Limited / full</span>
        <p>Times are estimates. Please arrive early.</p>
      </footer>
    </main>
  );
}
