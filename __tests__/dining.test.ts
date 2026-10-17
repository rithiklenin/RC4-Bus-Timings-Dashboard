import { describe, expect, it } from "vitest";
import { DINING_PAGES, getCurrentMeal } from "@/lib/dining";

const sgtDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(date);

describe("getCurrentMeal", () => {
  it.each([
    ["2026-10-07T22:59:00+08:00", "dinner", "2026-10-07"],
    ["2026-10-07T23:00:00+08:00", "breakfast", "2026-10-08"],
    ["2026-10-08T00:30:00+08:00", "breakfast", "2026-10-08"],
    ["2026-10-08T10:59:00+08:00", "breakfast", "2026-10-08"],
    ["2026-10-08T11:00:00+08:00", "dinner", "2026-10-08"],
  ])("at %s shows %s for %s", (time, meal, date) => {
    const result = getCurrentMeal(new Date(time));
    expect(result.meal).toBe(meal);
    expect(sgtDate(result.serviceDate)).toBe(date);
  });
});

describe("DINING_PAGES", () => {
  it("shows every cuisine in pairs", () => {
    expect(DINING_PAGES.dinner.map((page) => page.map((cuisine) => cuisine.name))).toEqual([
      ["Malay", "Western"],
      ["Indian", "Indian Vegetarian"],
      ["Asian", "Asian Vegetarian"],
      ["Noodles"],
    ]);
  });
});
