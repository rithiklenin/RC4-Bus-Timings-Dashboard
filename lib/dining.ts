export type Meal = "breakfast" | "dinner";

export interface Cuisine {
  name: string;
  vegetarian?: boolean;
  dishes: string[];
}

// Placeholder until a dining hall API is available. Cuisines are shown in pairs, in this order.
export const PLACEHOLDER_MENU: Record<Meal, Cuisine[]> = {
  breakfast: [
    { name: "Malay", dishes: ["Nasi lemak", "Sambal ikan bilis", "Fried egg", "Cucumber"] },
    { name: "Western", dishes: ["Scrambled eggs", "Chicken sausage", "Hash brown", "Baked beans", "Toast"] },
    { name: "Indian", dishes: ["Roti prata", "Chicken curry", "Dhal"] },
    { name: "Indian Vegetarian", vegetarian: true, dishes: ["Thosai", "Coconut chutney", "Sambar"] },
    { name: "Asian", dishes: ["Chicken porridge", "Century egg", "You tiao"] },
    { name: "Asian Vegetarian", vegetarian: true, dishes: ["Plain porridge", "Braised peanuts", "Stir-fried cabbage"] },
    { name: "Noodles", dishes: ["Fried bee hoon", "Luncheon meat", "Sunny side up"] },
  ],
  dinner: [
    { name: "Malay", dishes: ["Rice", "Ayam masak merah", "Sayur lodeh", "Begedil"] },
    { name: "Western", dishes: ["Grilled chicken chop", "Mashed potato", "Coleslaw", "Garlic bread"] },
    { name: "Indian", dishes: ["Briyani rice", "Mutton curry", "Cabbage poriyal", "Papadum"] },
    { name: "Indian Vegetarian", vegetarian: true, dishes: ["Jeera rice", "Paneer butter masala", "Aloo gobi", "Chapati"] },
    { name: "Asian", dishes: ["Rice", "Soya chicken", "Steamed fish", "Braised vegetables"] },
    { name: "Asian Vegetarian", vegetarian: true, dishes: ["Rice", "Mapo tofu", "Stir-fried kailan", "Vegetarian mock duck"] },
    { name: "Noodles", dishes: ["Laksa", "Fish cake", "Tau pok", "Bean sprouts"] },
  ],
};

export const DINING_PAGES: Record<Meal, Cuisine[][]> = {
  breakfast: toPairs(PLACEHOLDER_MENU.breakfast),
  dinner: toPairs(PLACEHOLDER_MENU.dinner),
};

function toPairs(cuisines: Cuisine[]) {
  const pages: Cuisine[][] = [];
  for (let index = 0; index < cuisines.length; index += 2) pages.push(cuisines.slice(index, index + 2));
  return pages;
}

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Breakfast runs from 11pm the night before to 11am; dinner from 11am to 11pm.
export function getCurrentMeal(now: Date): { meal: Meal; serviceDate: Date; nextSwitch: string } {
  const sgt = new Date(now.getTime() + SGT_OFFSET_MS);
  const hour = sgt.getUTCHours();
  const meal: Meal = hour >= 11 && hour < 23 ? "dinner" : "breakfast";
  const day = Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()) + (hour >= 23 ? DAY_MS : 0);
  // Noon SGT on the service day, so formatting in Asia/Singapore always lands on the right date.
  const serviceDate = new Date(day + 12 * 60 * 60 * 1000 - SGT_OFFSET_MS);
  return { meal, serviceDate, nextSwitch: meal === "dinner" ? "11pm" : "11am" };
}
