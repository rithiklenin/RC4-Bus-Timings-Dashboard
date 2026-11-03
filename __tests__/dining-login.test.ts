import { describe, expect, it } from "vitest";
import { encodePendingDiningLogin, extractUpstreamSessionCookie, readPendingDiningLogin } from "@/lib/dining-login";

describe("Dining login handoff", () => {
  it("round-trips the pending state and upstream affinity cookies", () => {
    const pending = {
      state: "login-state",
      safeRequestId: "request-id",
      upstreamCookie: "ApplicationGatewayAffinity=one; ApplicationGatewayAffinityCORS=two",
    };
    expect(readPendingDiningLogin(encodePendingDiningLogin(pending))).toEqual(pending);
  });

  it("keeps only NUS application-gateway session cookies", () => {
    const headers = new Headers();
    Object.defineProperty(headers, "getSetCookie", {
      value: () => [
        "ApplicationGatewayAffinityCORS=cors-value; Path=/; Secure",
        "ApplicationGatewayAffinity=affinity-value; Path=/",
        "Unrelated=value; Path=/",
      ],
    });

    expect(extractUpstreamSessionCookie(headers)).toBe(
      "ApplicationGatewayAffinityCORS=cors-value; ApplicationGatewayAffinity=affinity-value",
    );
  });

  it("rejects malformed pending-login cookies", () => {
    expect(readPendingDiningLogin("not-base64-json")).toBeNull();
  });
});
