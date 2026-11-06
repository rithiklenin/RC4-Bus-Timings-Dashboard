import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";

export const ADMIN_AUTH_COOKIE = "rc4-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const WHITELIST_PATH = join(process.cwd(), "config", "admin-whitelist.txt");

export interface AdminUser { email: string }
interface AdminSession extends AdminUser { expiresAt: number }

function sessionSecret() {
  return process.env.VERCEL_ENV === "production"
    ? process.env.BLOB_READ_WRITE_TOKEN
    : process.env.DINING_NONPROD_BLOB_READ_WRITE_TOKEN;
}

export function normalizeAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseAdminWhitelist(value: string) {
  return new Set(value.split(/\r?\n/)
    .map(normalizeAdminEmail)
    .filter((email) => email && !email.startsWith("#")));
}

export function readAdminWhitelist() {
  try { return parseAdminWhitelist(readFileSync(WHITELIST_PATH, "utf8")); }
  catch { return new Set<string>(); }
}

export function isWhitelistedAdminEmail(email: string) {
  return readAdminWhitelist().has(normalizeAdminEmail(email));
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSession(email: string, secret = sessionSecret()) {
  if (!secret) throw new Error("Admin session signing is not configured");
  const payload = Buffer.from(JSON.stringify({
    email: normalizeAdminEmail(email),
    expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  } satisfies AdminSession)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readAdminSession(value: string | undefined, allowedEmails = readAdminWhitelist(), secret = sessionSecret()): AdminSession | null {
  if (!value || !secret) return null;
  const [payload, suppliedSignature, extra] = value.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AdminSession>;
    const email = typeof session.email === "string" ? normalizeAdminEmail(session.email) : "";
    if (!email || !allowedEmails.has(email) || typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return null;
    return { email, expiresAt: session.expiresAt };
  } catch { return null; }
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value);
  return session ? { email: session.email } : null;
}

export function isAdminAuthConfigured() {
  return Boolean(sessionSecret() && readAdminWhitelist().size);
}
