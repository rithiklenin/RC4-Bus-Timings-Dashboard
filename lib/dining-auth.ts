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
  refreshTokenExpiresAt?: number;
}

declare global {
  // Kept in the server process for this prototype. It is intentionally not persisted.
  var rc4DiningAuth: DiningAuthSession | undefined;
}

function buildDiningSession(result: DiningAuthResult, previous?: DiningAuthSession): DiningAuthSession {
  const now = Date.now();
  const refreshToken = result.refreshToken ?? previous?.refreshToken;
  const refreshTokenExpiresAt = result.refreshTokenExpireInSeconds !== undefined
    ? now + result.refreshTokenExpireInSeconds * 1_000
    : previous?.refreshTokenExpiresAt;

  return {
    ...previous,
    ...result,
    refreshToken,
    refreshTokenExpiresAt,
    accessTokenExpiresAt: now + (result.accessTokenExpireInSeconds ?? 3_600) * 1_000,
    connectedAt: previous?.connectedAt ?? now,
  };
}

export async function storeDiningAuth(result: DiningAuthResult, previous?: DiningAuthSession) {
  const session = buildDiningSession(result, previous);
  globalThis.rc4DiningAuth = session;
  return session;
}

export async function clearDiningAuth() {
  globalThis.rc4DiningAuth = undefined;
}

export async function getDiningAuthStatus() {
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
  if (session.refreshTokenExpiresAt !== undefined && session.refreshTokenExpiresAt <= Date.now()) {
    await clearDiningAuth();
    throw new Error("The dining session has expired; reconnect it from the admin page");
  }

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
  const responseText = await response.text();
  let payload: { success?: boolean; result?: DiningAuthResult; error?: { message?: string } };
  try {
    payload = responseText ? JSON.parse(responseText) as typeof payload : {};
  } catch {
    await clearDiningAuth();
    throw new Error(`NUS Dining refresh returned non-JSON data (HTTP ${response.status})`);
  }
  if (!response.ok || !payload.success || !payload.result?.accessToken) {
    await clearDiningAuth();
    throw new Error(payload.error?.message ?? "Unable to refresh the dining session");
  }
  return storeDiningAuth(payload.result, session);
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
