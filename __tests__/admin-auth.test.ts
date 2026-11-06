import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSession, parseAdminWhitelist, readAdminSession } from "@/lib/admin-auth";

const secret = "test-blob-token-with-enough-entropy";
const allowed = new Set(["admin@u.nus.edu"]);

describe("prototype admin authentication", () => {
  afterEach(() => vi.useRealTimers());

  it("parses the email whitelist case-insensitively and ignores comments", () => {
    expect(parseAdminWhitelist("# admins\n Admin@u.nus.edu \n\nSECOND@nus.edu.sg\n"))
      .toEqual(new Set(["admin@u.nus.edu", "second@nus.edu.sg"]));
  });

  it("creates and verifies a signed session only for an allowed email", () => {
    const session = createAdminSession(" Admin@u.nus.edu ", secret);
    expect(readAdminSession(session, allowed, secret)).toMatchObject({ email: "admin@u.nus.edu" });
    expect(readAdminSession(session, new Set(), secret)).toBeNull();
  });

  it("rejects tampered sessions and sessions signed with another key", () => {
    const session = createAdminSession("admin@u.nus.edu", secret);
    expect(readAdminSession(`${session}x`, allowed, secret)).toBeNull();
    expect(readAdminSession(session, allowed, "different-token")).toBeNull();
  });

  it("rejects expired sessions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
    const session = createAdminSession("admin@u.nus.edu", secret);
    vi.advanceTimersByTime(ADMIN_SESSION_MAX_AGE_SECONDS * 1000 + 1);
    expect(readAdminSession(session, allowed, secret)).toBeNull();
  });
});
