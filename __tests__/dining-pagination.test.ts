import { describe, expect, it } from "vitest";
import { paginateDiningMenu, type DiningPage } from "@/lib/dining-pagination";

const stall = (name: string, count: number) => ({ name, dishes: Array.from({ length: count }, (_, index) => `${name} dish ${index + 1}`) });
const height = (page: DiningPage) => page.reduce((total, section) => total + 20 + (section.continuation ? 10 : 0) + Math.ceil(section.dishes.length / 2) * 20, 0) + Math.max(0, page.length - 1) * 8;

describe("adaptive dining pagination", () => {
  it("pairs stalls with unequal menu sizes when their combined content fits", () => {
    const menu = [stall("Asian", 8), stall("Western", 2), stall("Malay", 3)];
    const pages = paginateDiningMenu(menu, page => height(page) <= 150);
    expect(pages.map(page => page.map(section => section.name))).toEqual([["Asian", "Western"], ["Malay"]]);
  });

  it("uses separate pages when two complete stalls cannot fit together", () => {
    const pages = paginateDiningMenu([stall("Asian", 6), stall("Western", 6)], page => height(page) <= 100);
    expect(pages.map(page => page.length)).toEqual([1, 1]);
    expect(pages.every(page => height(page) <= 100)).toBe(true);
  });

  it("splits oversized stalls without dropping, duplicating, or reordering dishes", () => {
    const menu = [stall("Asian", 15), { ...stall("Indian Vegetarian", 9), vegetarian: true }];
    const pages = paginateDiningMenu(menu, page => height(page) <= 85);
    expect(pages.every(page => height(page) <= 85)).toBe(true);
    for (const original of menu) {
      const parts = pages.flat().filter(section => section.name === original.name);
      expect(parts.flatMap(part => part.dishes)).toEqual(original.dishes);
      expect(parts[0].continuation).toBe(false);
      expect(parts.slice(1).every(part => part.continuation)).toBe(true);
    }
    expect(pages.flat().filter(section => section.name === "Indian Vegetarian").every(section => section.vegetarian)).toBe(true);
    expect(new Set(pages.flat().map(section => section.id)).size).toBe(pages.flat().length);
  });

  it("handles empty menus and progresses even if one dish cannot fit", () => {
    expect(paginateDiningMenu([], () => true)).toEqual([]);
    const menu = [stall("Asian", 2)];
    const pages = paginateDiningMenu(menu, () => false);
    expect(pages.flatMap(page => page.flatMap(section => section.dishes))).toEqual(menu[0].dishes);
  });
});
