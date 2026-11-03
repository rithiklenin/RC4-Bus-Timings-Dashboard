export interface PendingDiningLogin {
  safeRequestId: string;
  state: string;
  upstreamCookie?: string;
}

export function encodePendingDiningLogin(login: PendingDiningLogin) {
  return Buffer.from(JSON.stringify(login)).toString("base64url");
}

export function readPendingDiningLogin(value: string | undefined): PendingDiningLogin | null {
  if (!value) return null;
  try {
    const login = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PendingDiningLogin;
    if (!login.state || !login.safeRequestId) return null;
    return login;
  } catch {
    return null;
  }
}

export function extractUpstreamSessionCookie(headers: Headers) {
  const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? (headers.get("set-cookie") ? [headers.get("set-cookie")!] : []);
  const cookies = values
    .map((value) => value.split(";", 1)[0])
    .filter((value) => /^ApplicationGatewayAffinity(?:CORS)?=/i.test(value));
  return cookies.length ? cookies.join("; ") : undefined;
}
