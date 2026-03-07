import type { DashboardCategory, DashboardFood, FoodTimelineEntry, ProgressSummary } from "@/lib/types";
import { getUpdatedTimestamp } from "@/lib/ui-utils";

export type CategoryKpi = {
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  discoveredCount: number;
  discoveredPercent: number;
  donePercent: number;
};

export function buildProgressSummary(categories: DashboardCategory[]): ProgressSummary {
  const foods = categories.flatMap((category) => category.foods);
  const introducedCount = foods.filter((food) => food.tastingCount > 0).length;
  const likedCount = foods.filter((food) => food.finalPreference === 1).length;
  const recentFoodNames = foods
    .filter((food) => food.updatedAt)
    .sort((a, b) => getUpdatedTimestamp(b.updatedAt) - getUpdatedTimestamp(a.updatedAt))
    .slice(0, 3)
    .map((food) => food.name);

  return {
    introducedCount,
    totalFoods: foods.length,
    likedCount,
    recentFoodNames
  };
}

export function buildCategoryKpi(foods: DashboardFood[]): CategoryKpi {
  const totalCount = foods.length;
  let todoCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;
  let discoveredCount = 0;

  for (const food of foods) {
    const tastingCount = Math.max(0, Math.trunc(food.tastingCount));

    if (tastingCount === 0) {
      todoCount += 1;
      continue;
    }

    discoveredCount += 1;

    if (tastingCount >= 3) {
      doneCount += 1;
      continue;
    }

    inProgressCount += 1;
  }

  const discoveredPercent = totalCount > 0 ? (discoveredCount / totalCount) * 100 : 0;
  const donePercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return {
    totalCount,
    todoCount,
    inProgressCount,
    doneCount,
    discoveredCount,
    discoveredPercent,
    donePercent
  };
}

export function buildTimelineEntries(categories: DashboardCategory[]): FoodTimelineEntry[] {
  const entries: FoodTimelineEntry[] = [];

  for (const category of categories) {
    for (const food of category.foods) {
      for (const tasting of food.tastings) {
        entries.push({
          foodId: food.id,
          foodName: food.name,
          categoryName: category.name,
          slot: tasting.slot,
          tastedOn: tasting.tastedOn,
          liked: tasting.liked,
          note: tasting.note,
          textureLevel: tasting.textureLevel,
          reactionType: tasting.reactionType
        });
      }
    }
  }

  return entries;
}
