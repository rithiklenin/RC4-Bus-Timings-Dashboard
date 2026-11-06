import { DASHBOARD_CONFIG } from "@/lib/dashboard-config";

export function watchDeployment(version: string, reload: () => void) {
  let stopped = false;
  let request: AbortController | null = null;
  let timeout: number | undefined;

  async function check() {
    if (stopped || request) return;
    request = new AbortController();
    timeout = window.setTimeout(() => request?.abort(), 10_000);
    try {
      // Use the current origin without a deployment header or cookies that could
      // pin this check to the build already loaded by the browser.
      const response = await fetch(`/api/version?check=${Date.now()}`, {
        cache: "no-store", credentials: "omit", signal: request.signal,
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (!stopped && data && typeof data === "object" && "version" in data
        && typeof data.version === "string" && data.version.trim() && data.version !== version) {
        stop();
        reload();
      }
    } catch {
      // Keep the current dashboard through outages and retry on the next check.
    } finally {
      window.clearTimeout(timeout);
      request = null;
    }
  }

  const interval = window.setInterval(() => void check(), DASHBOARD_CONFIG.deploymentCheckMs);
  window.addEventListener("online", check);
  function stop() {
    stopped = true;
    window.clearInterval(interval);
    window.clearTimeout(timeout);
    window.removeEventListener("online", check);
    request?.abort();
  }
  void check();
  return stop;
}
