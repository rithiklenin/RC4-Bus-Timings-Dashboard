const DINING_API_BASE = "https://inetapps.nus.edu.sg/mnusds/api/";

export interface DiningAuthResult {
  accessToken: string;
  accessTokenExpireInSeconds?: number;
  email?: string;
  fullName?: string;
  refreshToken?: string;
  refreshTokenExpireInSeconds?: number;
  roleName?: string;
  safeRequestId?: string;
  userId: number;
}

interface DiningAuthSession extends DiningAuthResult {
  accessTokenExpiresAt: number;
  connectedAt: number;
}

declare global {
  // Kept in the server process for this prototype. It is intentionally not persisted.
  var rc4DiningAuth: DiningAuthSession | undefined;
}

export function storeDiningAuth(result: DiningAuthResult) {
  globalThis.rc4DiningAuth = {
    ...result,
    accessTokenExpiresAt: Date.now() + (result.accessTokenExpireInSeconds ?? 3_600) * 1_000,
    connectedAt: Date.now(),
  };
}

export function clearDiningAuth() {
  globalThis.rc4DiningAuth = undefined;
}

export function getDiningAuthStatus() {
  const session = globalThis.rc4DiningAuth;
  if (!session) return { connected: false as const };
  return {
    connected: true as const,
    connectedAt: new Date(session.connectedAt).toISOString(),
    email: session.email,
    expiresAt: new Date(session.accessTokenExpiresAt).toISOString(),
    fullName: session.fullName,
    roleName: session.roleName,
  };
}

async function refreshDiningAuth(session: DiningAuthSession) {
  if (!session.refreshToken) throw new Error("The dining session cannot be refreshed");

  const response = await fetch(`${DINING_API_BASE}TokenAuth/RefreshToken`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
    }),
  });
  const payload = await response.json() as { success?: boolean; result?: DiningAuthResult; error?: { message?: string } };
  if (!response.ok || !payload.success || !payload.result?.accessToken) {
    clearDiningAuth();
    throw new Error(payload.error?.message ?? "Unable to refresh the dining session");
  }
  storeDiningAuth(payload.result);
  return globalThis.rc4DiningAuth!;
}

async function getActiveDiningAuth() {
  const session = globalThis.rc4DiningAuth;
  if (!session) throw new Error("NUS Dining is not connected");
  if (session.accessTokenExpiresAt > Date.now() + 60_000) return session;
  return refreshDiningAuth(session);
}

export async function diningApiFetch(path: string, init: RequestInit = {}) {
  const session = await getActiveDiningAuth();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  return fetch(new URL(path.replace(/^\/+/, ""), DINING_API_BASE), {
    ...init,
    cache: "no-store",
    headers,
  });
}

