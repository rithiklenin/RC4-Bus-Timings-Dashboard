import { diningApiFetch } from "@/lib/dining-auth";
import { normalizeMenu, sortDiningMenuItems, type DailyMenuGroup, type DiningMenuResponse } from "@/lib/dining-menu-shared";

export { normalizeMenu, sortDiningMenuItems } from "@/lib/dining-menu-shared";
export type { DiningMenuItem, DiningMenuResponse } from "@/lib/dining-menu-shared";

interface ApiEnvelope<T> {
  error?: { message?: string } | null;
  result?: T;
  success?: boolean;
}

interface ProfileCredit {
  hallId: number;
  hallName: string;
  mealTypes?: Array<{ mealId: number; meallName: string }>;
}

interface DailyStation {
  stationId: number;
}

function singaporeDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: value("day"), hour: Number(value("hour")), month: value("month"), weekday: value("weekday"), year: value("year") };
}

export function selectMeal(now: Date) {
  const { weekday, hour } = singaporeDateParts(now);
  if (weekday === "Sun") return { id: 2, name: "Dinner", serviceHours: "5:30–9:30 PM" };
  if (weekday === "Sat") return { id: 1, name: "Breakfast", serviceHours: "7:00–10:30 AM" };
  return hour < 12
    ? { id: 1, name: "Breakfast", serviceHours: "7:00–10:30 AM" }
    : { id: 2, name: "Dinner", serviceHours: "5:30–9:30 PM" };
}

export function formatDiningDate(now: Date) {
  const { day, month, year } = singaporeDateParts(now);
  return `${day}/${month}/${year}`;
}

async function readEnvelope<T>(path: string) {
  const response = await diningApiFetch(path);
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.success || payload.result === undefined) {
    throw new Error(payload.error?.message ?? `NUS Dining returned ${response.status}`);
  }
  return payload.result;
}

export async function getDiningMenu(now = new Date()): Promise<DiningMenuResponse> {
  const profile = await readEnvelope<{ credits?: ProfileCredit[] }>("User/ProfileDetail");
  const hall = profile.credits?.find((credit) => /\bRC4\b/i.test(credit.hallName)) ?? profile.credits?.[0];
  if (!hall) throw new Error("No dining hall is attached to this account");

  const meal = selectMeal(now);
  const mealId = hall.mealTypes?.find((item) => item.meallName.toLowerCase() === meal.name.toLowerCase())?.mealId ?? meal.id;
  const menuDate = formatDiningDate(now);
  const stationParams = new URLSearchParams({ HallId: String(hall.hallId), MealTypeId: String(mealId), MenuDate: menuDate });
  const stations = await readEnvelope<DailyStation[]>(`DailyMenu/GetDailyStationList?${stationParams}`);
  const station = stations[0];
  if (!station) throw new Error(`No ${meal.name.toLowerCase()} menu is published for today`);

  const menuParams = new URLSearchParams({ HallId: String(hall.hallId), MealTypeId: String(mealId), StationId: String(station.stationId), MenuDate: menuDate });
  const groups = await readEnvelope<DailyMenuGroup[]>(`DailyMenu/GetDailyMenuByHall?${menuParams}`);
  const items = sortDiningMenuItems(normalizeMenu(groups));
  if (!items.length) throw new Error(`No ${meal.name.toLowerCase()} menu is published for today`);

  return {
    dateLabel: new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", weekday: "long", day: "numeric", month: "short" }).format(now),
    hallName: hall.hallName,
    items,
    mealName: meal.name,
    serviceHours: meal.serviceHours,
    updatedAt: new Date().toISOString(),
  };
}

