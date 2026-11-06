import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchDeployment } from "@/lib/deployment-updates";
import { DASHBOARD_CONFIG } from "@/lib/dashboard-config";
import { GET } from "@/app/api/version/route";
import { DEPLOYMENT_VERSION } from "@/lib/deployment-version";

const flush = async () => { for (let index = 0; index < 10; index++) await Promise.resolve(); };
let stop: (() => void) | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("deployment updates", () => {
  it("exposes the embedded version without browser or CDN caching", async () => {
    const response = GET();
    expect(await response.json()).toEqual({ version: DEPLOYMENT_VERSION });
    for (const header of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control"]) {
      expect(response.headers.get(header)).toContain("no-store");
    }
  });

  it("keeps the page when versions match and checks every minute", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "build-a" }) });
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    stop = watchDeployment("build-a", reload);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toMatch(/^\/api\/version\?check=/);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "omit" });
    await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG.deploymentCheckMs);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("compares the first response against the loaded build and reloads only once", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "build-b" }) });
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    stop = watchDeployment("build-a", reload);
    await flush();
    await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG.deploymentCheckMs * 3);
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { version: "" }, { version: "  " }, { version: 4 }])("ignores invalid version data %j", async data => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    const reload = vi.fn();
    stop = watchDeployment("build-a", reload);
    await flush();
    expect(reload).not.toHaveBeenCalled();
  });

  it("retries after network, HTTP, and JSON errors without reloading", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("invalid JSON"); } })
      .mockResolvedValue({ ok: true, json: async () => ({ version: "build-b" }) });
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    stop = watchDeployment("build-a", reload);
    await flush();
    await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG.deploymentCheckMs * 2);
    expect(reload).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not overlap requests and aborts and ignores responses after cleanup", async () => {
    let resolve!: (response: unknown) => void;
    const fetcher = vi.fn(() => new Promise(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    stop = watchDeployment("build-a", reload);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG.deploymentCheckMs);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const signal = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1].signal!;
    expect(signal.aborted).toBe(true);
    stop();
    resolve({ ok: true, json: async () => ({ version: "build-b" }) });
    await flush();
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG.deploymentCheckMs);
    expect(reload).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
