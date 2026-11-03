import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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
  // Cached in memory, with a local file fallback so development restarts do not disconnect Dining.
  var rc4DiningAuth: DiningAuthSession | undefined;
}

function sessionFile() {
  return process.env.DINING_SESSION_FILE || join(process.cwd(), ".data", "dining-auth.json");
}

function isDiningAuthSession(value: unknown): value is DiningAuthSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<DiningAuthSession>;
  return typeof session.accessToken === "string"
    && session.accessToken.length > 0
    && typeof session.accessTokenExpiresAt === "number"
    && typeof session.connectedAt === "number"
    && typeof session.userId === "number";
}

async function readDiningAuth() {
  if (globalThis.rc4DiningAuth) return globalThis.rc4DiningAuth;
  try {
    const stored = JSON.parse(await readFile(/* turbopackIgnore: true */ sessionFile(), "utf8")) as unknown;
    if (!isDiningAuthSession(stored)) throw new Error("The stored Dining session is invalid");
    globalThis.rc4DiningAuth = stored;
    return stored;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    console.error("Unable to restore the Dining session", error instanceof Error ? error.message : error);
    return undefined;
  }
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
  const file = sessionFile();
  const temporaryFile = `${file}.${process.pid}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(temporaryFile, JSON.stringify(session), { encoding: "utf8", mode: 0o600 });
  await rename(temporaryFile, file);
  globalThis.rc4DiningAuth = session;
  return session;
}

export async function clearDiningAuth() {
  globalThis.rc4DiningAuth = undefined;
  await rm(sessionFile(), { force: true });
}

export async function getDiningAuthStatus() {
  const session = await readDiningAuth();
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
  const payload = await response.json() as { success?: boolean; result?: DiningAuthResult; error?: { message?: string } };
  if (!response.ok || !payload.success || !payload.result?.accessToken) {
    await clearDiningAuth();
    throw new Error(payload.error?.message ?? "Unable to refresh the dining session");
  }
  return storeDiningAuth(payload.result, session);
}

async function getActiveDiningAuth() {
  const session = await readDiningAuth();
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
