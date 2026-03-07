import type {
  DashboardCategory,
  DashboardFood,
  FoodTimelineEntry,
  ProgressSummary,
  PublicShareCategoryFoodList,
  PublicShareCategoryDiscovery,
  PublicShareCumulativeTastingsPoint,
  PublicSharePreferenceKey,
  PublicSharePreferenceFoodLists,
  PublicShareOverview
} from "@/lib/types";
import { getUpdatedTimestamp } from "@/lib/ui-utils";

const FOOD_NAME_COLLATOR = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

type PublicShareCollectedFood = {
  foodId: number;
  foodName: string;
  preferenceKey: PublicSharePreferenceKey;
  isCompleted: boolean;
};

type PublicShareCollectedCategory = {
  categoryId: number;
  categoryName: string;
  foods: PublicShareCollectedFood[];
};

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

function getPublicSharePreferenceKey(food: Pick<DashboardFood, "finalPreference" | "tastingCount">): PublicSharePreferenceKey {
  if (food.tastingCount >= 3) {
    if (food.finalPreference === 1) {
      return "liked";
    }

    if (food.finalPreference === -1) {
      return "disliked";
    }
  }

  return "neutral";
}

function collectPublicShareCategoryFoods(categories: DashboardCategory[]): PublicShareCollectedCategory[] {
  return categories.map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    foods: category.foods
      .filter((food) => food.tastingCount > 0)
      .map((food) => ({
        foodId: food.id,
        foodName: food.name,
        preferenceKey: getPublicSharePreferenceKey(food),
        isCompleted: food.tastingCount >= 3
      }))
      .sort((a, b) => FOOD_NAME_COLLATOR.compare(a.foodName, b.foodName))
  }));
}

export function buildPublicSharePreferenceFoodLists(categories: DashboardCategory[]): PublicSharePreferenceFoodLists {
  const foodLists: PublicSharePreferenceFoodLists = {
    liked: [],
    neutral: [],
    disliked: []
  };

  for (const category of collectPublicShareCategoryFoods(categories)) {
    for (const food of category.foods) {
      if (!food.isCompleted) continue;
      foodLists[food.preferenceKey].push(food.foodName);
    }
  }

  return {
    liked: [...foodLists.liked].sort(FOOD_NAME_COLLATOR.compare),
    neutral: [...foodLists.neutral].sort(FOOD_NAME_COLLATOR.compare),
    disliked: [...foodLists.disliked].sort(FOOD_NAME_COLLATOR.compare)
  };
}

export function buildPublicShareCategoryFoodLists(categories: DashboardCategory[]): PublicShareCategoryFoodList[] {
  return collectPublicShareCategoryFoods(categories).map((category) => ({
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    foods: category.foods.map((food) => ({
      foodId: food.foodId,
      foodName: food.foodName,
      preferenceKey: food.preferenceKey
    }))
  }));
}

function addOneUtcDay(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function compareIsoDates(a: string, b: string) {
  return getUpdatedTimestamp(`${a}T00:00:00.000Z`) - getUpdatedTimestamp(`${b}T00:00:00.000Z`);
}

export function buildPublicShareCumulativeTastings(
  tastingDates: string[],
  todayIso: string
): PublicShareCumulativeTastingsPoint[] {
  const tastingCountByDay = new Map<string, number>();
  let firstTastingOn: string | null = null;

  for (const tastedOn of tastingDates) {
    tastingCountByDay.set(tastedOn, (tastingCountByDay.get(tastedOn) || 0) + 1);

    if (firstTastingOn === null || compareIsoDates(tastedOn, firstTastingOn) < 0) {
      firstTastingOn = tastedOn;
    }
  }

  if (firstTastingOn === null) {
    return [];
  }

  const points: PublicShareCumulativeTastingsPoint[] = [];
  const rangeEnd = compareIsoDates(todayIso, firstTastingOn) >= 0 ? todayIso : firstTastingOn;
  let currentDate = firstTastingOn;
  let cumulativeTotal = 0;

  while (compareIsoDates(currentDate, rangeEnd) <= 0) {
    const tastingsOnDay = tastingCountByDay.get(currentDate) || 0;
    cumulativeTotal += tastingsOnDay;
    points.push({
      date: currentDate,
      totalTastings: cumulativeTotal,
      tastingsOnDay
    });
    currentDate = addOneUtcDay(currentDate);
  }

  return points;
}

export function buildPublicShareOverview(categories: DashboardCategory[], todayIso: string): PublicShareOverview {
  const foods = categories.flatMap((category) => category.foods);
  const introducedCount = foods.filter((food) => food.tastingCount > 0).length;
  const completedFoods = foods.filter((food) => food.tastingCount >= 3);
  const completedCount = completedFoods.length;
  const introducedPercent = foods.length > 0 ? (introducedCount / foods.length) * 100 : 0;

  const completedPreferenceCounts = completedFoods.reduce(
    (counts, food) => {
      if (food.finalPreference === 1) {
        counts.liked += 1;
      } else if (food.finalPreference === -1) {
        counts.disliked += 1;
      } else {
        counts.neutral += 1;
      }

      return counts;
    },
    { liked: 0, neutral: 0, disliked: 0 }
  );

  const categoryDiscoveryCounts: PublicShareCategoryDiscovery[] = categories.map((category) => {
    const totalCount = category.foods.length;
    const discoveredCount = category.foods.filter((food) => food.tastingCount > 0).length;

    return {
      categoryId: category.id,
      categoryName: category.name,
      totalCount,
      discoveredCount,
      discoveredPercent: totalCount > 0 ? (discoveredCount / totalCount) * 100 : 0
    };
  });

  const tastingDates = foods.flatMap((food) => food.tastings.map((tasting) => tasting.tastedOn));
  const totalTastings = tastingDates.length;
  const cumulativeTastings = buildPublicShareCumulativeTastings(tastingDates, todayIso);

  return {
    introducedCount,
    introducedPercent,
    totalFoods: foods.length,
    completedCount,
    completedPreferenceCounts,
    categoryDiscoveryCounts,
    cumulativeTastings,
    totalTastings
  };
}
