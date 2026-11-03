import { describe, expect, it } from "vitest";
import { readJsonResponse } from "@/lib/response-json";

describe("readJsonResponse", () => {
  it("reads a JSON response", async () => {
    await expect(readJsonResponse<{ connected: boolean }>(
      new Response(JSON.stringify({ connected: true }), { status: 200 }),
      "Unable to read response",
    )).resolves.toEqual({ connected: true });
  });

  it("reports an empty upstream response without throwing a JSON parser error", async () => {
    await expect(readJsonResponse(new Response(null, { status: 502 }), "Unable to connect"))
      .rejects.toThrow("Unable to connect (HTTP 502: empty response)");
  });

  it("reports a non-JSON upstream response", async () => {
    await expect(readJsonResponse(new Response("Bad Gateway", { status: 502 }), "Unable to connect"))
      .rejects.toThrow("Unable to connect (HTTP 502: non-JSON response)");
  });
});
