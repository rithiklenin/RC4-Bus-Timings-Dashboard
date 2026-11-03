import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDiningAuth, diningApiFetch, getDiningAuthStatus, storeDiningAuth } from "@/lib/dining-auth";

describe("Dining authentication persistence", () => {
  let directory: string;
  let file: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "rc4-dining-auth-"));
    file = join(directory, "session.json");
    process.env.DINING_SESSION_FILE = file;
    globalThis.rc4DiningAuth = undefined;
  });

  afterEach(async () => {
    globalThis.rc4DiningAuth = undefined;
    delete process.env.DINING_SESSION_FILE;
    vi.unstubAllGlobals();
    await rm(directory, { force: true, recursive: true });
  });

  it("restores a connected session after the in-memory cache is lost", async () => {
    await storeDiningAuth({
      accessToken: "access-token",
      accessTokenExpireInSeconds: 3_600,
      refreshToken: "refresh-token",
      refreshTokenExpireInSeconds: 7_200,
      userId: 42,
    });

    globalThis.rc4DiningAuth = undefined;

    await expect(getDiningAuthStatus()).resolves.toMatchObject({ connected: true });
    await clearDiningAuth();
    await expect(getDiningAuthStatus()).resolves.toEqual({ connected: false });
  });

  it("preserves the refresh token when NUS only returns a new access token", async () => {
    await storeDiningAuth({
      accessToken: "expired-access-token",
      accessTokenExpireInSeconds: 0,
      refreshToken: "refresh-token",
      refreshTokenExpireInSeconds: 7_200,
      userId: 42,
    });

    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("TokenAuth/RefreshToken")) {
        return Promise.resolve(new Response(JSON.stringify({
          success: true,
          result: { accessToken: "new-access-token", accessTokenExpireInSeconds: 3_600, userId: 42 },
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    }));

    const response = await diningApiFetch("User/ProfileDetail");
    expect(response.ok).toBe(true);

    const stored = JSON.parse(await readFile(file, "utf8")) as { accessToken: string; refreshToken: string };
    expect(stored).toMatchObject({ accessToken: "new-access-token", refreshToken: "refresh-token" });
  });
});
