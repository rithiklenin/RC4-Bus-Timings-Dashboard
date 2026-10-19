import { describe, expect, it } from "vitest";
import { formatDiningDate, normalizeMenu, selectMeal, sortDiningMenuItems } from "@/lib/dining-menu";

describe("dining menu helpers", () => {
  it("orders primary cuisines before the remaining API order", () => {
    const items = [
      { name: "Indian Vegetarian", dishes: ["Dhal"] },
      { name: "Western", dishes: ["Chicken chop"] },
      { name: "Asian", dishes: ["Rice"] },
      { name: "Dessert", dishes: ["Fruit"] },
      { name: "Noodle Station", dishes: ["Laksa"] },
      { name: "Muslim", dishes: ["Nasi goreng"] },
      { name: "Indian", dishes: ["Curry"] },
      { name: "Cereal", dishes: ["Corn flakes"] },
    ];

    expect(sortDiningMenuItems(items).map((item) => item.name)).toEqual([
      "Muslim",
      "Asian",
      "Indian",
      "Noodle Station",
      "Western",
      "Indian Vegetarian",
      "Dessert",
      "Cereal",
    ]);
  });

  it("selects the serving meal using Singapore time", () => {
    expect(selectMeal(new Date("2026-10-17T03:00:00.000Z")).name).toBe("Breakfast");
    expect(selectMeal(new Date("2026-10-18T03:00:00.000Z")).name).toBe("Dinner");
    expect(selectMeal(new Date("2026-10-19T01:00:00.000Z")).name).toBe("Breakfast");
    expect(selectMeal(new Date("2026-10-19T07:00:00.000Z")).name).toBe("Dinner");
  });

  it("formats dates for the Dining API", () => {
    expect(formatDiningDate(new Date("2026-10-16T16:30:00.000Z"))).toBe("17/10/2026");
  });

  it("normalizes cuisine groups and removes empty dishes", () => {
    expect(normalizeMenu([
      { cuisine: "Asian", lists: [{ menuTitle: "Tom Yum Noodles" }, { menuTitle: " " }] },
      { cuisine: "Empty", lists: [] },
    ])).toEqual([{ name: "Asian", dishes: ["Tom Yum Noodles"] }]);
  });
});

