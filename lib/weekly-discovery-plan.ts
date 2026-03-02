import type { DashboardCategory, DashboardFood } from "@/lib/types";
import { FRENCH_COLLATOR, getTimelineDateTimestamp, getTodayIsoDate } from "@/lib/ui-utils";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ABANDON_AFTER_DAYS = 10;
const PLAN_DAY_COUNT = 7;
const ALLERGEN_CATEGORY_NAME = "Allergènes majeurs";

const WEEKLY_TEMPLATE: WeeklyPlanFocus[] = [
  "relaunch",
  "new_discovery",
  "allergen_routine",
  "consolidation",
  "new_discovery",
  "allergen_routine",
  "relaunch"
];

export type WeeklyPlanFocus = "relaunch" | "new_discovery" | "allergen_routine" | "consolidation";

export type WeeklyDiscoveryPlanItem = {
  date: string;
  focus: WeeklyPlanFocus;
  foodId: number;
  foodName: string;
  categoryName: string;
  tastingCount: number;
  isAbandonedAtGeneration: boolean;
  reason: string;
};

export type WeeklyDiscoveryPlanStats = {
  abandonmentCount: number;
  newFoodsCount: number;
  allergenPendingCount: number;
  consolidationCount: number;
};

export type WeeklyDiscoveryPlanSnapshot = {
  generatedOn: string;
  stats: WeeklyDiscoveryPlanStats;
  items: WeeklyDiscoveryPlanItem[];
};

type PlanCandidate = {
  foodId: number;
  foodName: string;
  categoryName: string;
  tastingCount: number;
  lastTastedOn: string | null;
  daysSinceLastTasting: number | null;
  isAllergen: boolean;
  isAbandoned: boolean;
};

type CandidateQueues = {
  relaunch: PlanCandidate[];
  newDiscovery: PlanCandidate[];
  allergenRoutine: PlanCandidate[];
  consolidation: PlanCandidate[];
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

  const deltaDays = Math.floor((todayTimestamp - tastingTimestamp) / DAY_IN_MS);
  if (!Number.isFinite(deltaDays)) return null;
  return Math.max(0, deltaDays);
}

function compareByNameAndCategory(a: PlanCandidate, b: PlanCandidate) {
  const categoryDiff = FRENCH_COLLATOR.compare(a.categoryName, b.categoryName);
  if (categoryDiff !== 0) return categoryDiff;
  return FRENCH_COLLATOR.compare(a.foodName, b.foodName);
}

function compareByRelaunchPriority(a: PlanCandidate, b: PlanCandidate) {
  if (a.isAbandoned !== b.isAbandoned) return Number(b.isAbandoned) - Number(a.isAbandoned);

  const aDays = a.daysSinceLastTasting ?? -1;
  const bDays = b.daysSinceLastTasting ?? -1;
  if (aDays !== bDays) return bDays - aDays;

  if (a.tastingCount !== b.tastingCount) return b.tastingCount - a.tastingCount;
  return compareByNameAndCategory(a, b);
}

function compareByDiscoveryPriority(a: PlanCandidate, b: PlanCandidate) {
  if (a.tastingCount !== b.tastingCount) return a.tastingCount - b.tastingCount;
  return compareByNameAndCategory(a, b);
}

function compareByAllergenPriority(a: PlanCandidate, b: PlanCandidate) {
  if (a.tastingCount !== b.tastingCount) return a.tastingCount - b.tastingCount;

  const aDays = a.daysSinceLastTasting ?? -1;
  const bDays = b.daysSinceLastTasting ?? -1;
  if (aDays !== bDays) return bDays - aDays;

  return compareByNameAndCategory(a, b);
}

function compareByConsolidationPriority(a: PlanCandidate, b: PlanCandidate) {
  if (a.tastingCount !== b.tastingCount) return b.tastingCount - a.tastingCount;

  const aDays = a.daysSinceLastTasting ?? -1;
  const bDays = b.daysSinceLastTasting ?? -1;
  if (aDays !== bDays) return bDays - aDays;

  return compareByNameAndCategory(a, b);
}

function buildCandidates(categories: DashboardCategory[], todayTimestamp: number): PlanCandidate[] {
  const candidates: PlanCandidate[] = [];

  for (const category of categories) {
    for (const food of category.foods) {
      const lastTastedOn = getLastTastedOn(food);
      const daysSinceLastTasting = getDaysSinceLastTasting(lastTastedOn, todayTimestamp);
      const isAbandoned =
        food.tastingCount >= 1 &&
        food.tastingCount <= 2 &&
        daysSinceLastTasting !== null &&
        daysSinceLastTasting >= ABANDON_AFTER_DAYS;

      candidates.push({
        foodId: food.id,
        foodName: food.name,
        categoryName: category.name,
        tastingCount: food.tastingCount,
        lastTastedOn,
        daysSinceLastTasting,
        isAllergen: category.name === ALLERGEN_CATEGORY_NAME,
        isAbandoned
      });
    }
  }

  return candidates;
}

function pickCandidateFromQueues(
  queues: PlanCandidate[][],
  usedFoodIds: Set<number>,
  previousFoodId: number | null
): PlanCandidate | null {
  const match = (predicate: (candidate: PlanCandidate) => boolean) => {
    for (const queue of queues) {
      const candidate = queue.find(predicate);
      if (candidate) return candidate;
    }
    return null;
  };

  return (
    match((candidate) => !usedFoodIds.has(candidate.foodId) && candidate.foodId !== previousFoodId) ??
    match((candidate) => !usedFoodIds.has(candidate.foodId)) ??
    match((candidate) => candidate.foodId !== previousFoodId) ??
    match(() => true)
  );
}

function removeCandidateFromQueues(queues: CandidateQueues, selectedFoodId: number) {
  for (const queue of [queues.relaunch, queues.newDiscovery, queues.allergenRoutine, queues.consolidation]) {
    const index = queue.findIndex((candidate) => candidate.foodId === selectedFoodId);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }
}

function getPrimaryQueuesByFocus(focus: WeeklyPlanFocus, queues: CandidateQueues): PlanCandidate[][] {
  if (focus === "relaunch") {
    return [queues.relaunch, queues.consolidation, queues.newDiscovery, queues.allergenRoutine];
  }

  if (focus === "new_discovery") {
    return [queues.newDiscovery, queues.relaunch, queues.consolidation, queues.allergenRoutine];
  }

  if (focus === "allergen_routine") {
    return [queues.allergenRoutine, queues.relaunch, queues.newDiscovery, queues.consolidation];
  }

  return [queues.consolidation, queues.relaunch, queues.newDiscovery, queues.allergenRoutine];
}

function getFocusReason(focus: WeeklyPlanFocus, candidate: PlanCandidate) {
  if (focus === "relaunch") {
    if (candidate.daysSinceLastTasting !== null && candidate.daysSinceLastTasting >= ABANDON_AFTER_DAYS) {
      return `Relancer maintenant évite de perdre l'habitude (${candidate.daysSinceLastTasting} jours).`;
    }

    return "Encore une petite victoire aujourd'hui: vous gardez l'élan de votre bébé.";
  }

  if (focus === "new_discovery") {
    return "Nouvelle découverte pour élargir la diversité alimentaire.";
  }

  if (focus === "allergen_routine") {
    if (candidate.isAllergen && candidate.tastingCount >= 1 && candidate.tastingCount < 3) {
      return "Répétition allergène pour maintenir la régularité d'exposition.";
    }

    return "Continuer la progression pendant la pause allergène.";
  }

  if (candidate.tastingCount >= 2) {
    return "Objectif 3/3: consolider avant de conclure la préférence finale.";
  }

  return "Consolidation progressive pour stabiliser l'acceptation.";
}

function getPlanDate(todayIsoDate: string, offsetDays: number) {
  const date = new Date(`${todayIsoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildCandidateQueues(candidates: PlanCandidate[]): CandidateQueues {
  const blockedOrInProgress = candidates
    .filter((candidate) => candidate.tastingCount >= 1 && candidate.tastingCount <= 2)
    .sort(compareByRelaunchPriority);

  const newDiscovery = candidates
    .filter((candidate) => !candidate.isAllergen && candidate.tastingCount === 0)
    .sort(compareByDiscoveryPriority);

  const allergenRoutine = candidates
    .filter((candidate) => candidate.isAllergen && candidate.tastingCount >= 1 && candidate.tastingCount < 3)
    .sort(compareByAllergenPriority);

  const consolidation = candidates
    .filter((candidate) => candidate.tastingCount >= 1 && candidate.tastingCount <= 2)
    .sort(compareByConsolidationPriority);

  return {
    relaunch: blockedOrInProgress,
    newDiscovery,
    allergenRoutine,
    consolidation
  };
}

export function buildWeeklyDiscoveryPlan(categories: DashboardCategory[]): WeeklyDiscoveryPlanSnapshot {
  const todayIsoDate = getTodayIsoDate();
  const todayTimestamp = getTimelineDateTimestamp(todayIsoDate);
  const candidates = buildCandidates(categories, todayTimestamp);
  const candidateQueues = buildCandidateQueues(candidates);

  const usedFoodIds = new Set<number>();
  let previousFoodId: number | null = null;

  const allCandidatesByPriority = [...candidates].sort(compareByRelaunchPriority);
  const items: WeeklyDiscoveryPlanItem[] = [];

  for (let dayIndex = 0; dayIndex < PLAN_DAY_COUNT; dayIndex += 1) {
    const focus = WEEKLY_TEMPLATE[dayIndex] ?? "relaunch";
    const primaryQueues = getPrimaryQueuesByFocus(focus, candidateQueues);
    const selected: PlanCandidate | null =
      pickCandidateFromQueues(primaryQueues, usedFoodIds, previousFoodId) ??
      pickCandidateFromQueues([allCandidatesByPriority], usedFoodIds, previousFoodId);

    if (!selected) continue;

    items.push({
      date: getPlanDate(todayIsoDate, dayIndex),
      focus,
      foodId: selected.foodId,
      foodName: selected.foodName,
      categoryName: selected.categoryName,
      tastingCount: selected.tastingCount,
      isAbandonedAtGeneration: selected.isAbandoned,
      reason: getFocusReason(focus, selected)
    });

    previousFoodId = selected.foodId;
    usedFoodIds.add(selected.foodId);
    removeCandidateFromQueues(candidateQueues, selected.foodId);
  }

  const abandonmentCount = candidates.filter((candidate) => candidate.isAbandoned).length;
  const newFoodsCount = candidates.filter((candidate) => !candidate.isAllergen && candidate.tastingCount === 0).length;
  const allergenPendingCount = candidates.filter(
    (candidate) => candidate.isAllergen && candidate.tastingCount >= 1 && candidate.tastingCount < 3
  ).length;
  const consolidationCount = items.filter((item) => item.focus === "consolidation").length;

  return {
    generatedOn: todayIsoDate,
    stats: {
      abandonmentCount,
      newFoodsCount,
      allergenPendingCount,
      consolidationCount
    },
    items
  };
}
