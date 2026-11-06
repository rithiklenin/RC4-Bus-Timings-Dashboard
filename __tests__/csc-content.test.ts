import { beforeEach, describe, expect, it, vi } from "vitest";
const blob = vi.hoisted(() => ({ data: "" as string | undefined, get: vi.fn(), put: vi.fn() }));
vi.mock("@vercel/blob", () => ({ get: blob.get, put: blob.put }));
import { DEFAULT_CSC_CONTENT, getCscContent, updateCscContent } from "@/lib/csc-content";

const stream = (value: string) => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(value)); controller.close(); } });

describe("CSC highlight content", () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    process.env.DINING_NONPROD_BLOB_READ_WRITE_TOKEN = "blob-secret";
    blob.data = undefined;
    blob.get.mockImplementation(async () => blob.data ? { statusCode: 200, stream: stream(blob.data) } : null);
    blob.put.mockImplementation(async (_path: string, value: string, options: object) => {
      expect(options).toMatchObject({ access: "private", token: "blob-secret", addRandomSuffix: false, allowOverwrite: true });
      blob.data = value;
    });
  });

  it("starts with three dashboard highlights", async () => {
    expect((await getCscContent()).items).toEqual(DEFAULT_CSC_CONTENT);
  });

  it("stores and reloads a validated set of highlight cards in Blob", async () => {
    const items = DEFAULT_CSC_CONTENT.map((item, index) => ({ ...item, title: `Updated ${index + 1}` }));
    const result = await updateCscContent(items);
    expect(result.items.map((item) => item.title)).toEqual(["Updated 1", "Updated 2", "Updated 3"]);
    expect(result.updatedAt).toBeTruthy();
    await expect(getCscContent()).resolves.toEqual(result);
  });

  it("rejects incomplete or oversized content", async () => {
    await expect(updateCscContent(DEFAULT_CSC_CONTENT.slice(0, 2))).rejects.toThrow("Exactly three");
    await expect(updateCscContent(DEFAULT_CSC_CONTENT.map((item, index) => index === 0 ? { ...item, title: "x".repeat(65) } : item))).rejects.toThrow("64 characters");
  });
});
