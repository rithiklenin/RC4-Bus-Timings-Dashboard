import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const blob = vi.hoisted(() => ({ data: "" as string | undefined, get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => ({
  get: blob.get, put: blob.put, del: blob.del,
}));
import { clearDiningAuth, diningApiFetch, getDiningAuthStatus, storeDiningAuth } from "@/lib/dining-auth";
const key = Buffer.alloc(32, 7).toString("base64");
const stream = (value: string) => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(value)); c.close(); } });
describe("Blob Dining auth", () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    process.env.DINING_NONPROD_BLOB_READ_WRITE_TOKEN = "blob-secret"; process.env.BLOB_READ_WRITE_TOKEN = "wrong-production-token"; process.env.DINING_AUTH_ENCRYPTION_KEY = key; blob.data = undefined;
    blob.get.mockImplementation(async (_path: string, options: object) => { expect(options).toMatchObject({ access: "private", useCache: false, token: process.env.VERCEL_ENV === "production" ? "wrong-production-token" : "blob-secret" }); return blob.data ? { statusCode: 200, stream: stream(blob.data) } : null; });
    blob.put.mockImplementation(async (_path: string, value: string, options: object) => { expect(options).toMatchObject({ access: "private", addRandomSuffix: false, allowOverwrite: true }); blob.data = value; });
    blob.del.mockImplementation(async () => { blob.data = undefined; });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("writes an encrypted envelope and reads it from storage", async () => {
    await storeDiningAuth({ accessToken: "secret-access", refreshToken: "secret-refresh", userId: 42, email: "user@example.test" });
    expect(blob.data).not.toContain("secret-access"); expect(blob.data).not.toContain("secret-refresh");
    expect(JSON.parse(blob.data!)).toMatchObject({ version: 1 });
    await expect(getDiningAuthStatus()).resolves.toMatchObject({ connected: true, email: "user@example.test" });
  });
  it("treats absent sessions as disconnected and deletion as successful", async () => {
    await expect(getDiningAuthStatus()).resolves.toEqual({ connected: false }); await expect(clearDiningAuth()).resolves.toBeUndefined();
  });
  it("selects the production store only in production", async () => {
    process.env.VERCEL_ENV = "production";
    await expect(getDiningAuthStatus()).resolves.toEqual({ connected: false });
    expect(blob.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ token: "wrong-production-token" }));
  });
  it("uses the nonproduction token in Preview", async () => {
    process.env.VERCEL_ENV = "preview";
    blob.get.mockImplementationOnce(async (_path: string, options: object) => { expect(options).toMatchObject({ token: "blob-secret" }); return null; });
    await expect(getDiningAuthStatus()).resolves.toEqual({ connected: false });
  });
  it("persists refresh and retains an omitted refresh token", async () => {
    await storeDiningAuth({ accessToken: "old", accessTokenExpireInSeconds: 0, refreshToken: "keep", userId: 1 });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("RefreshToken")
      ? new Response(JSON.stringify({ success: true, result: { accessToken: "new", userId: 1 } })) : new Response("{}")));
    await diningApiFetch("User/ProfileDetail");
    expect(blob.put).toHaveBeenCalledTimes(2); expect(await getDiningAuthStatus()).toMatchObject({ connected: true });
  });
  it("rejects missing config, corrupt ciphertext and storage errors", async () => {
    delete process.env.DINING_AUTH_ENCRYPTION_KEY;
    await expect(getDiningAuthStatus()).rejects.toThrow("not configured"); process.env.DINING_AUTH_ENCRYPTION_KEY = key;
    blob.data = JSON.stringify({ version: 1, nonce: Buffer.alloc(12).toString("base64"), tag: Buffer.alloc(16).toString("base64"), ciphertext: "eA==" });
    await expect(getDiningAuthStatus()).rejects.toThrow("Unable to read Dining session");
    blob.get.mockRejectedValueOnce(new Error("credential leaked")); await expect(getDiningAuthStatus()).rejects.toThrow("Unable to read Dining session");
  });
});
