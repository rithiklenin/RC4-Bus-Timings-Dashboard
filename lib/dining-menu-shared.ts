export interface DiningMenuItem {
  dishes: string[];
  name: string;
}

export interface DiningMenuResponse {
  dateLabel: string;
  hallName: string;
  items: DiningMenuItem[];
  mealName: string;
  serviceHours: string;
  updatedAt: string;
}

export interface DailyMenuGroup {
  cuisine: string;
  lists?: Array<{ menuTitle?: string }>;
}

export function normalizeMenu(groups: DailyMenuGroup[]): DiningMenuItem[] {
  return groups
    .map((group) => ({
      name: group.cuisine,
      dishes: (group.lists ?? []).map((item) => item.menuTitle?.trim()).filter((title): title is string => Boolean(title)),
    }))
    .filter((group) => group.name && group.dishes.length);
}

function cuisinePriority(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized === "muslim" || normalized === "malay") return 0;
  if (normalized === "asian") return 1;
  if (normalized === "indian") return 2;
  if (normalized === "noodle" || normalized === "noodles" || normalized.includes("noodle station")) return 3;
  if (normalized === "western") return 4;
  return 5;
}

export function sortDiningMenuItems(items: DiningMenuItem[]) {
  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => cuisinePriority(left.item.name) - cuisinePriority(right.item.name) || left.index - right.index)
    .map(({ item }) => item);
}
