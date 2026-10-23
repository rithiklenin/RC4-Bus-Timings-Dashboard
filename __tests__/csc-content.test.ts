import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CSC_CONTENT, getCscContent, updateCscContent } from "@/lib/csc-content";

describe("CSC highlight content", () => {
  beforeEach(() => {
    globalThis.rc4CscContent = undefined;
  });

  it("starts with three dashboard highlights", () => {
    expect(getCscContent().items).toEqual(DEFAULT_CSC_CONTENT);
  });

  it("stores a validated set of highlight cards", () => {
    const items = DEFAULT_CSC_CONTENT.map((item, index) => ({ ...item, title: `Updated ${index + 1}` }));
    const result = updateCscContent(items);
    expect(result.items.map((item) => item.title)).toEqual(["Updated 1", "Updated 2", "Updated 3"]);
    expect(result.updatedAt).toBeTruthy();
  });

  it("rejects incomplete or oversized content", () => {
    expect(() => updateCscContent(DEFAULT_CSC_CONTENT.slice(0, 2))).toThrow("Exactly three");
    expect(() => updateCscContent(DEFAULT_CSC_CONTENT.map((item, index) => index === 0 ? { ...item, title: "x".repeat(65) } : item))).toThrow("64 characters");
  });
});
