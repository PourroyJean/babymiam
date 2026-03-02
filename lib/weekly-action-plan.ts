import type { DashboardCategory, DashboardFood } from "@/lib/types";
import { FRENCH_COLLATOR, getTimelineDateTimestamp, getTodayIsoDate } from "@/lib/ui-utils";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PLAN_DAYS = 7;
const BLOCKED_AFTER_DAYS = 7;
const URGENT_AFTER_DAYS = 14;

type SlotStats = {
  score: number;
  count: number;
};

type RankedFood = {
  foodId: number;
  foodName: string;
  categoryId: number;
  categoryName: string;
  tastingCount: number;
  lastTastedOn: string | null;
  daysSinceLastTasting: number | null;
  isBlocked: boolean;
  isUrgent: boolean;
  preferredSlot: 1 | 2 | 3 | null;
  finalPreference: -1 | 0 | 1;
};

export type WeeklyActionFocus = "retry_blocked" | "new_discovery" | "consolidation";

export type WeeklyActionPlanItem = {
  day: string;
  foodId: number;
  foodName: string;
  categoryName: string;
  focus: WeeklyActionFocus;
  reason: string;
  tastingCount: number;
  daysSinceLastTasting: number | null;
  isUrgent: boolean;
  suggestedSlot: 1 | 2 | 3;
};

export type WeeklyActionPlanStats = {
  blockedBacklogCount: number;
  urgentBacklogCount: number;
  plannedRetryCount: number;
  plannedDiscoveryCount: number;
  plannedConsolidationCount: number;
};

export type WeeklyActionPlanSnapshot = {
  stats: WeeklyActionPlanStats;
  items: WeeklyActionPlanItem[];
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

function getDaysSinceLastTasting(lastTastedOn: string | null, todayTimestamp: number) {
  if (!lastTastedOn) return null;
  const tastingTimestamp = getTimelineDateTimestamp(lastTastedOn);
  if (tastingTimestamp <= 0) return null;

  const rawDelta = Math.floor((todayTimestamp - tastingTimestamp) / DAY_IN_MS);
  if (!Number.isFinite(rawDelta)) return null;
  return Math.max(0, rawDelta);
}

function getPreferredSlot(food: DashboardFood): 1 | 2 | 3 | null {
  const slotStats: Record<1 | 2 | 3, SlotStats> = {
    1: { score: 0, count: 0 },
    2: { score: 0, count: 0 },
    3: { score: 0, count: 0 }
  };

  for (const tasting of food.tastings) {
    const slot = tasting.slot;
    const slotStat = slotStats[slot];
    slotStat.count += 1;

    if (tasting.liked === true) {
      slotStat.score += 2;
      continue;
    }

    if (tasting.liked === null) {
      slotStat.score += 1;
      continue;
    }

    slotStat.score -= 1;
  }

  let bestSlot: 1 | 2 | 3 | null = null;

  for (const slot of [1, 2, 3] as const) {
    const current = slotStats[slot];
    if (current.count === 0) continue;

    if (!bestSlot) {
      bestSlot = slot;
      continue;
    }

    const best = slotStats[bestSlot];
    if (current.score !== best.score) {
      if (current.score > best.score) {
        bestSlot = slot;
      }
      continue;
    }

    if (current.count !== best.count) {
      if (current.count > best.count) {
        bestSlot = slot;
      }
      continue;
    }

    if (slot < bestSlot) {
      bestSlot = slot;
    }
  }

  return bestSlot;
}

function toIsoDateWithOffset(baseIsoDate: string, dayOffset: number) {
  const baseTimestamp = getTimelineDateTimestamp(baseIsoDate);
  if (baseTimestamp <= 0) return baseIsoDate;

  const shifted = new Date(baseTimestamp + dayOffset * DAY_IN_MS);
  return shifted.toISOString().slice(0, 10);
}

function compareByCategoryAndName(a: RankedFood, b: RankedFood) {
  const categoryDiff = FRENCH_COLLATOR.compare(a.categoryName, b.categoryName);
  if (categoryDiff !== 0) return categoryDiff;
  return FRENCH_COLLATOR.compare(a.foodName, b.foodName);
}

function compareRetryPriority(a: RankedFood, b: RankedFood) {
  if (a.isUrgent !== b.isUrgent) return Number(b.isUrgent) - Number(a.isUrgent);

  const aDays = a.daysSinceLastTasting ?? 0;
  const bDays = b.daysSinceLastTasting ?? 0;
  if (aDays !== bDays) return bDays - aDays;

  if (a.tastingCount !== b.tastingCount) return b.tastingCount - a.tastingCount;
  return compareByCategoryAndName(a, b);
}

function compareConsolidationPriority(a: RankedFood, b: RankedFood) {
  if (a.tastingCount !== b.tastingCount) return b.tastingCount - a.tastingCount;

  const aDays = a.daysSinceLastTasting ?? 0;
  const bDays = b.daysSinceLastTasting ?? 0;
  if (aDays !== bDays) return bDays - aDays;

  return compareByCategoryAndName(a, b);
}

function pickCandidate(pool: RankedFood[], usedFoodIds: Set<number>, allowReuse = false) {
  for (const candidate of pool) {
    if (!usedFoodIds.has(candidate.foodId)) return candidate;
  }

  if (allowReuse && pool.length > 0) {
    return pool[0];
  }

  return null;
}

function pickFocusReason(candidate: RankedFood, focus: WeeklyActionFocus) {
  if (focus === "retry_blocked") {
    const days = candidate.daysSinceLastTasting ?? 0;
    if (candidate.isUrgent) {
      return `Bloqué depuis ${days} jours: relance prioritaire pour éviter le décrochage.`;
    }

    return `Bloqué depuis ${days} jours: on relance en douceur cette semaine.`;
  }

  if (focus === "new_discovery") {
    return "Jamais testé: parfait pour avancer la diversification sans surcharge.";
  }

  if (candidate.tastingCount >= 2) {
    return "2/3 essais déjà faits: une dernière exposition pour consolider.";
  }

  if (candidate.tastingCount === 1) {
    return "1/3 essai validé: faire la 2e exposition pour ancrer l’habitude.";
  }

  return "Aliment connu: consolidation pour garder des repas sereins.";
}

export function buildWeeklyActionPlan(categories: DashboardCategory[]): WeeklyActionPlanSnapshot {
  if (categories.length === 0) {
    return {
      stats: {
        blockedBacklogCount: 0,
        urgentBacklogCount: 0,
        plannedRetryCount: 0,
        plannedDiscoveryCount: 0,
        plannedConsolidationCount: 0
      },
      items: []
    };
  }

  const todayIso = getTodayIsoDate();
  const todayTimestamp = getTimelineDateTimestamp(todayIso);
  const categoryDiscoveryRatioById = new Map<number, number>();

  for (const category of categories) {
    const discoveredCount = category.foods.filter((food) => food.tastingCount > 0).length;
    const totalCount = category.foods.length;
    const ratio = totalCount > 0 ? discoveredCount / totalCount : 1;
    categoryDiscoveryRatioById.set(category.id, ratio);
  }

  const rankedFoods: RankedFood[] = categories.flatMap((category) =>
    category.foods.map((food) => {
      const lastTastedOn = getLastTastedOn(food);
      const daysSinceLastTasting = getDaysSinceLastTasting(lastTastedOn, todayTimestamp);
      const isBlocked =
        food.tastingCount >= 1 &&
        food.tastingCount <= 2 &&
        daysSinceLastTasting !== null &&
        daysSinceLastTasting >= BLOCKED_AFTER_DAYS;
      const isUrgent = isBlocked && (daysSinceLastTasting ?? 0) >= URGENT_AFTER_DAYS;

      return {
        foodId: food.id,
        foodName: food.name,
        categoryId: category.id,
        categoryName: category.name,
        tastingCount: food.tastingCount,
        lastTastedOn,
        daysSinceLastTasting,
        isBlocked,
        isUrgent,
        preferredSlot: getPreferredSlot(food),
        finalPreference: food.finalPreference
      };
    })
  );

  const retryPool = rankedFoods.filter((food) => food.isBlocked).sort(compareRetryPriority);
  const urgentRetryPool = retryPool.filter((food) => food.isUrgent);

  const discoveryPool = rankedFoods
    .filter((food) => food.tastingCount === 0)
    .sort((a, b) => {
      const ratioA = categoryDiscoveryRatioById.get(a.categoryId) ?? 1;
      const ratioB = categoryDiscoveryRatioById.get(b.categoryId) ?? 1;
      if (ratioA !== ratioB) return ratioA - ratioB;
      return compareByCategoryAndName(a, b);
    });

  const consolidationPool = rankedFoods
    .filter((food) => food.tastingCount >= 1 && food.tastingCount <= 2 && !food.isBlocked)
    .sort(compareConsolidationPriority);

  const reinforcementPool = rankedFoods
    .filter((food) => food.tastingCount >= 3 && food.finalPreference === 1)
    .sort(compareByCategoryAndName);

  const fallbackPool = [...rankedFoods].sort(compareByCategoryAndName);
  const usedFoodIds = new Set<number>();
  const items: WeeklyActionPlanItem[] = [];
  let plannedRetryCount = 0;
  let plannedDiscoveryCount = 0;
  let plannedConsolidationCount = 0;

  const focusPools: Record<WeeklyActionFocus, RankedFood[]> = {
    retry_blocked: retryPool,
    new_discovery: discoveryPool,
    consolidation: consolidationPool
  };

  for (let dayIndex = 0; dayIndex < PLAN_DAYS; dayIndex += 1) {
    const day = toIsoDateWithOffset(todayIso, dayIndex);
    const dayDefaultSlot = ((dayIndex % 3) + 1) as 1 | 2 | 3;

    const urgentCandidate = pickCandidate(urgentRetryPool, usedFoodIds);
    let selectedCandidate: RankedFood | null = urgentCandidate;
    let selectedFocus: WeeklyActionFocus | null = urgentCandidate ? "retry_blocked" : null;

    if (!selectedCandidate) {
      const dayFocusOrder: WeeklyActionFocus[] =
        dayIndex % 2 === 0
          ? ["retry_blocked", "new_discovery", "consolidation"]
          : ["new_discovery", "retry_blocked", "consolidation"];

      for (const focus of dayFocusOrder) {
        const poolCandidate = pickCandidate(focusPools[focus], usedFoodIds);
        if (!poolCandidate) continue;
        selectedCandidate = poolCandidate;
        selectedFocus = focus;
        break;
      }
    }

    if (!selectedCandidate || !selectedFocus) {
      const fallbackCandidate =
        pickCandidate(reinforcementPool, usedFoodIds) ||
        pickCandidate(fallbackPool, usedFoodIds) ||
        pickCandidate(retryPool, usedFoodIds, true) ||
        pickCandidate(discoveryPool, usedFoodIds, true) ||
        pickCandidate(consolidationPool, usedFoodIds, true) ||
        pickCandidate(reinforcementPool, usedFoodIds, true) ||
        pickCandidate(fallbackPool, usedFoodIds, true);

      if (!fallbackCandidate) {
        break;
      }

      selectedCandidate = fallbackCandidate;

      if (fallbackCandidate.isBlocked) {
        selectedFocus = "retry_blocked";
      } else if (fallbackCandidate.tastingCount === 0) {
        selectedFocus = "new_discovery";
      } else {
        selectedFocus = "consolidation";
      }
    }

    const nextExposureStep = selectedCandidate.tastingCount >= 3 ? 3 : ((selectedCandidate.tastingCount + 1) as 1 | 2 | 3);
    const suggestedSlot =
      selectedFocus === "new_discovery" ? 1 : selectedCandidate.preferredSlot ?? nextExposureStep ?? dayDefaultSlot;
    const reason = pickFocusReason(selectedCandidate, selectedFocus);

    items.push({
      day,
      foodId: selectedCandidate.foodId,
      foodName: selectedCandidate.foodName,
      categoryName: selectedCandidate.categoryName,
      focus: selectedFocus,
      reason,
      tastingCount: selectedCandidate.tastingCount,
      daysSinceLastTasting: selectedCandidate.daysSinceLastTasting,
      isUrgent: selectedCandidate.isUrgent,
      suggestedSlot
    });

    usedFoodIds.add(selectedCandidate.foodId);

    if (selectedFocus === "retry_blocked") {
      plannedRetryCount += 1;
      continue;
    }

    if (selectedFocus === "new_discovery") {
      plannedDiscoveryCount += 1;
      continue;
    }

    plannedConsolidationCount += 1;
  }

  return {
    stats: {
      blockedBacklogCount: retryPool.length,
      urgentBacklogCount: urgentRetryPool.length,
      plannedRetryCount,
      plannedDiscoveryCount,
      plannedConsolidationCount
    },
    items
  };
}
