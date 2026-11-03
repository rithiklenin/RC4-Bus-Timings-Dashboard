const DEFAULT_NUSBUS_BASE = "https://nusbus.app/api";

export async function fetchNusBusShuttleService(stopCode: string): Promise<unknown> {
  const base = (process.env.NUSBUS_BASE_URL?.trim() || DEFAULT_NUSBUS_BASE).replace(/\/$/, "");
  const url = new URL(`${base}/shuttle-service`);
  url.searchParams.set("busstopname", stopCode);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`nusbus.app returned HTTP ${response.status}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("nusbus.app returned non-JSON data");
  }
}
