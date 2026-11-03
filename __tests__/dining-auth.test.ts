import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diningApiFetch, getDiningAuthStatus, storeDiningAuth } from "@/lib/dining-auth";

describe("Dining authentication session", () => {
  beforeEach(async () => {
    globalThis.rc4DiningAuth = undefined;
  });

  afterEach(async () => {
    globalThis.rc4DiningAuth = undefined;
    vi.unstubAllGlobals();
  });

  it("does not restore a session after the in-memory cache is lost", async () => {
    await storeDiningAuth({
      accessToken: "access-token",
      accessTokenExpireInSeconds: 3_600,
      refreshToken: "refresh-token",
      refreshTokenExpireInSeconds: 7_200,
      userId: 42,
    });

    globalThis.rc4DiningAuth = undefined;

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

    expect(globalThis.rc4DiningAuth).toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "refresh-token",
    });
  });
});
