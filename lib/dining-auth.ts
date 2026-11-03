import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { del, get, put } from "@vercel/blob";

const DINING_API_BASE = "https://inetapps.nus.edu.sg/mnusds/api/";
const SESSION_PATH = "rc4-bus-timings-dashboard/dining-auth/session.json";

export class DiningAuthError extends Error {
  constructor(message: string, readonly kind: "configuration" | "storage" | "upstream" | "disconnected" = "storage") { super(message); }
}
export interface DiningAuthResult {
  accessToken: string; accessTokenExpireInSeconds?: number; email?: string; fullName?: string;
  refreshToken?: string; refreshTokenExpireInSeconds?: number; roleName?: string; safeRequestId?: string; userId: number;
}
interface DiningAuthSession extends DiningAuthResult { accessTokenExpiresAt: number; connectedAt: number; refreshTokenExpiresAt?: number }
function config() {
  const token = process.env.VERCEL_ENV === "production"
    ? process.env.BLOB_READ_WRITE_TOKEN
    : process.env.DINING_NONPROD_BLOB_READ_WRITE_TOKEN;
  const encoded = process.env.DINING_AUTH_ENCRYPTION_KEY;
  if (!token || !encoded) throw new DiningAuthError("Dining persistence is not configured", "configuration");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new DiningAuthError("Dining encryption configuration is invalid", "configuration");
  return { token, key };
}
const validSession = (s: unknown): s is DiningAuthSession => {
  if (!s || typeof s !== "object") return false;
  const x = s as Partial<DiningAuthSession>;
  return typeof x.accessToken === "string" && !!x.accessToken && typeof x.userId === "number" && Number.isFinite(x.accessTokenExpiresAt) && Number.isFinite(x.connectedAt) && (x.refreshToken === undefined || typeof x.refreshToken === "string");
};
async function readSession(): Promise<DiningAuthSession | undefined> {
  const { token, key } = config();
  try {
    const item = await get(SESSION_PATH, { access: "private", useCache: false, token });
    if (!item) return;
    if (item.statusCode !== 200 || !item.stream) throw new Error();
    const env = JSON.parse(Buffer.from(await new Response(item.stream).arrayBuffer()).toString()) as Record<string, unknown>;
    if (env.version !== 1 || typeof env.nonce !== "string" || typeof env.tag !== "string" || typeof env.ciphertext !== "string") throw new Error();
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(env.nonce, "base64")); d.setAuthTag(Buffer.from(env.tag, "base64"));
    const value = JSON.parse(Buffer.concat([d.update(Buffer.from(env.ciphertext, "base64")), d.final()]).toString());
    if (!validSession(value)) throw new Error();
    return value;
  } catch { throw new DiningAuthError("Unable to read Dining session"); }
}
async function writeSession(session: DiningAuthSession) {
  const { token, key } = config();
  const nonce = randomBytes(12); const c = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([c.update(JSON.stringify(session)), c.final()]);
  try { await put(SESSION_PATH, JSON.stringify({ version: 1, nonce: nonce.toString("base64"), tag: c.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") }), { access: "private", token, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); }
  catch { throw new DiningAuthError("Unable to save Dining session"); }
}
function build(result: DiningAuthResult, previous?: DiningAuthSession): DiningAuthSession {
  const now=Date.now(); return { ...previous, ...result, refreshToken: result.refreshToken ?? previous?.refreshToken, refreshTokenExpiresAt: result.refreshTokenExpireInSeconds !== undefined ? now+result.refreshTokenExpireInSeconds*1000 : previous?.refreshTokenExpiresAt, accessTokenExpiresAt: now+(result.accessTokenExpireInSeconds ?? 3600)*1000, connectedAt: previous?.connectedAt ?? now };
}
export async function storeDiningAuth(result: DiningAuthResult) { const session=build(result); await writeSession(session); return session; }
export async function clearDiningAuth() { const {token}=config(); try { await del(SESSION_PATH,{token}); } catch { throw new DiningAuthError("Unable to disconnect Dining"); } }
export async function getDiningAuthStatus() { const s=await readSession(); return s ? {connected:true as const,connectedAt:new Date(s.connectedAt).toISOString(),email:s.email,expiresAt:new Date(s.accessTokenExpiresAt).toISOString(),fullName:s.fullName,roleName:s.roleName} : {connected:false as const}; }
async function refresh(s: DiningAuthSession) {
 if (!s.refreshToken) throw new DiningAuthError("The dining session cannot be refreshed","upstream");
 if(s.refreshTokenExpiresAt!==undefined&&s.refreshTokenExpiresAt<=Date.now()){await clearDiningAuth();throw new DiningAuthError("The dining session has expired; reconnect it from the admin page","disconnected");}
 let r:Response; try { r=await fetch(`${DINING_API_BASE}TokenAuth/RefreshToken`,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:s.accessToken,refreshToken:s.refreshToken,userId:s.userId})}); } catch { throw new DiningAuthError("Unable to refresh Dining session","upstream"); }
 const p=await r.json().catch(()=>null) as {success?:boolean;result?:DiningAuthResult}|null;
 if(!r.ok||!p?.success||!p.result?.accessToken) throw new DiningAuthError("Unable to refresh Dining session","upstream");
 const n=build(p.result,s); await writeSession(n); return n;
}
export async function diningApiFetch(path: string, init: RequestInit = {}) {
  const session = await readSession();
  if (!session) throw new DiningAuthError("NUS Dining is not connected", "disconnected");
  const active = session.accessTokenExpiresAt > Date.now() + 60_000 ? session : await refresh(session);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${active.accessToken}`);
  return fetch(new URL(path.replace(/^\/+/, ""), DINING_API_BASE), { ...init, cache: "no-store", headers });
}
