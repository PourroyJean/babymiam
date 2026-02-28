import type { DashboardCategory, DashboardFood } from "@/lib/types";
import { FRENCH_COLLATOR, getTimelineDateTimestamp, getTodayIsoDate } from "@/lib/ui-utils";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const BLOCKED_AFTER_DAYS = 7;
const URGENT_AFTER_DAYS = 14;

export type AntiForgetRadarStats = {
  blockedCount: number;
  urgentCount: number;
  inProgressCount: number;
};

export type AntiForgetRadarItem = {
  foodId: number;
  foodName: string;
  categoryName: string;
  tastingCount: number;
  lastTastedOn: string;
  daysSinceLastTasting: number;
  isUrgent: boolean;
};

export type AntiForgetRadarSnapshot = {
  stats: AntiForgetRadarStats;
  blockedFoods: AntiForgetRadarItem[];
};

function getLastTastedOn(food: DashboardFood): string | null {
  let lastDate = "";
  let lastTimestamp = -1;

  for (const tasting of food.tastings) {
    const tastingTimestamp = getTimelineDateTimestamp(tasting.tastedOn);
    if (tastingTimestamp <= lastTimestamp) continue;

    lastTimestamp = tastingTimestamp;
    lastDate = tasting.tastedOn;
  }

  return lastDate || null;
}

function getDaysSinceTasting(lastTastedOn: string, todayTimestamp: number) {
  const tastingTimestamp = getTimelineDateTimestamp(lastTastedOn);
  if (tastingTimestamp <= 0) return null;

  const rawDelta = Math.floor((todayTimestamp - tastingTimestamp) / DAY_IN_MS);
  if (!Number.isFinite(rawDelta)) return null;
  return Math.max(0, rawDelta);
}

export function buildAntiForgetRadar(categories: DashboardCategory[]): AntiForgetRadarSnapshot {
  const todayTimestamp = getTimelineDateTimestamp(getTodayIsoDate());
  const blockedFoods: AntiForgetRadarItem[] = [];
  let inProgressCount = 0;

  for (const category of categories) {
    for (const food of category.foods) {
      if (food.tastingCount < 1 || food.tastingCount > 2) continue;
      inProgressCount += 1;

      const lastTastedOn = getLastTastedOn(food);
      if (!lastTastedOn) continue;

      const daysSinceLastTasting = getDaysSinceTasting(lastTastedOn, todayTimestamp);
      if (daysSinceLastTasting === null || daysSinceLastTasting < BLOCKED_AFTER_DAYS) continue;

      blockedFoods.push({
        foodId: food.id,
        foodName: food.name,
        categoryName: category.name,
        tastingCount: food.tastingCount,
        lastTastedOn,
        daysSinceLastTasting,
        isUrgent: daysSinceLastTasting >= URGENT_AFTER_DAYS
      });
    }
  }

  blockedFoods.sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return Number(b.isUrgent) - Number(a.isUrgent);
    if (a.daysSinceLastTasting !== b.daysSinceLastTasting) {
      return b.daysSinceLastTasting - a.daysSinceLastTasting;
    }
    if (a.tastingCount !== b.tastingCount) return b.tastingCount - a.tastingCount;

    const categoryDiff = FRENCH_COLLATOR.compare(a.categoryName, b.categoryName);
    if (categoryDiff !== 0) return categoryDiff;
    return FRENCH_COLLATOR.compare(a.foodName, b.foodName);
  });

  const urgentCount = blockedFoods.filter((food) => food.isUrgent).length;

  return {
    stats: {
      blockedCount: blockedFoods.length,
      urgentCount,
      inProgressCount
    },
    blockedFoods
  };
}
