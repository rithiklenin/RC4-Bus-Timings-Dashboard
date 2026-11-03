import { Buffer } from "node:buffer";

const DEFAULT_AUTH_BASE = "https://myizaac2.nus.edu.sg";
const DEFAULT_BUS_PROXY_BASE = "https://inetapps.nus.edu.sg/univus/api/bus-proxy";
const DEFAULT_APP_VERSION = "2.56.0";
const DEFAULT_IP_ADDRESS = "0.0.0.0";
const TOKEN_REFRESH_SKEW_MS = 5 * 60_000;

interface UnivusEnvelope<T> {
  code?: string;
  msg?: string;
  data?: T;
}

interface PublicAccessData {
  token?: string;
  userid?: string;
  domain?: string;
}

interface UnivusConfig {
  authBase: string;
  busProxyBase: string;
  htdApiKey: string;
  appApiKey: string;
  busProxyApiKey: string;
  deviceId: string;
  appVersion: string;
  ipAddress: string;
}

interface PublicSession {
  token: string;
  userId: string;
  domain: string;
  expiresAt: number;
}

let cachedSession: { configKey: string; session: PublicSession } | null = null;
let inflightSession: { configKey: string; promise: Promise<PublicSession> } | null = null;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getConfig(): UnivusConfig {
  return {
    authBase: (process.env.UNIVUS_AUTH_BASE_URL?.trim() || DEFAULT_AUTH_BASE).replace(/\/$/, ""),
    busProxyBase: (
      process.env.UNIVUS_BUS_PROXY_BASE_URL?.trim() || DEFAULT_BUS_PROXY_BASE
    ).replace(/\/$/, ""),
    htdApiKey: required("UNIVUS_HTD_API_KEY"),
    appApiKey: required("UNIVUS_APP_API_KEY"),
    busProxyApiKey: required("UNIVUS_BUS_PROXY_API_KEY"),
    deviceId: required("UNIVUS_DEVICE_ID"),
    appVersion: process.env.UNIVUS_APP_VERSION?.trim() || DEFAULT_APP_VERSION,
    ipAddress: process.env.UNIVUS_IP_ADDRESS?.trim() || DEFAULT_IP_ADDRESS,
  };
}

function configKey(config: UnivusConfig): string {
  return [
    config.authBase,
    config.busProxyBase,
    config.htdApiKey,
    config.appApiKey,
    config.busProxyApiKey,
    config.deviceId,
    config.appVersion,
  ].join("\u0000");
}

function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function safeMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim().slice(0, 300) || fallback;
}

async function createSession(config: UnivusConfig): Promise<PublicSession> {
  const response = await fetch(`${config.authBase}/univus-public/mobile/get-access-token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-HTD-API": config.htdApiKey,
      "X-APP-API": config.appApiKey,
    },
    body: JSON.stringify({
      deviceid: config.deviceId,
      ipaddr: config.ipAddress,
      version: config.appVersion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  const text = await response.text();
  let payload: UnivusEnvelope<PublicAccessData>;
  try {
    payload = JSON.parse(text) as UnivusEnvelope<PublicAccessData>;
  } catch {
    throw new Error("uNivUS public-token endpoint returned non-JSON data");
  }
  if (!response.ok || payload.code !== "00000" || !payload.data) {
    throw new Error(
      `uNivUS public-token request failed with HTTP ${response.status}`
      + `${payload.code ? ` (${payload.code})` : ""}: ${safeMessage(payload.msg, "unknown error")}`,
    );
  }
  const { token, userid, domain } = payload.data;
  if (!token || !userid || !domain) {
    throw new Error("uNivUS public-token response is missing session details");
  }
  return {
    token,
    userId: userid,
    domain,
    expiresAt: jwtExpiry(token) || Date.now() + 23 * 60 * 60_000,
  };
}

async function getSession(config: UnivusConfig, forceRefresh = false): Promise<PublicSession> {
  const key = configKey(config);
  if (
    !forceRefresh
    && cachedSession?.configKey === key
    && cachedSession.session.expiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS
  ) {
    return cachedSession.session;
  }
  if (!forceRefresh && inflightSession?.configKey === key) return inflightSession.promise;

  const promise = createSession(config)
    .then((session) => {
      cachedSession = { configKey: key, session };
      return session;
    })
    .finally(() => {
      if (inflightSession?.promise === promise) inflightSession = null;
    });
  inflightSession = { configKey: key, promise };
  return promise;
}

async function postShuttleService(
  config: UnivusConfig,
  stopCode: string,
  forceRefresh = false,
): Promise<unknown> {
  const session = await getSession(config, forceRefresh);
  const response = await fetch(`${config.busProxyBase}/shuttle-service`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "x-api-key": config.busProxyApiKey,
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      token: session.token,
      userid: session.userId,
      domain: session.domain,
      deviceid: config.deviceId,
      ipaddr: config.ipAddress,
      version: config.appVersion,
      busstopname: stopCode,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  const text = await response.text();
  let payload: UnivusEnvelope<unknown>;
  try {
    payload = JSON.parse(text) as UnivusEnvelope<unknown>;
  } catch {
    throw new Error("uNivUS bus proxy returned non-JSON data");
  }

  const message = safeMessage(payload.msg, "unknown error");
  const tokenError = [
    "fail to verify access token",
    "invalid access token",
    "unauthorized access",
  ].includes(message.toLowerCase());
  if (!forceRefresh && tokenError) return postShuttleService(config, stopCode, true);

  if (!response.ok || payload.code !== "00000" || !payload.data) {
    throw new Error(
      `uNivUS bus proxy failed with HTTP ${response.status}`
      + `${payload.code ? ` (${payload.code})` : ""}: ${message}`,
    );
  }
  return payload.data;
}

export async function fetchUnivusShuttleService(stopCode: string): Promise<unknown> {
  return postShuttleService(getConfig(), stopCode);
}
