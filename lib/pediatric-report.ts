import { getReactionOption } from "@/lib/tasting-metadata";
import { getIsoDateForTimezoneOffset, normalizeTimezoneOffsetMinutes } from "@/lib/date-utils";
import type { ChildProfile, DashboardCategory, FoodTimelineEntry, FoodTastingEntry } from "@/lib/types";
import { formatDate } from "@/lib/ui-utils";

export type PediatricReportInput = {
  childProfile: ChildProfile | null;
  categories: DashboardCategory[];
  timelineEntries: FoodTimelineEntry[];
  generatedAt?: Date;
  timezoneOffsetMinutes?: number;
};

type RiskSignal = {
  level: "ALERTE" | "VIGILANCE" | "INFO";
  title: string;
  detail: string;
};

type AllergenReportRow = {
  foodName: string;
  exposureCount: number;
  lastExposureLabel: string;
  reactionMax: number | null;
  reactionMaxLabel: string;
  vigilanceNote: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 14;
const PREVIOUS_WINDOW_DAYS = 14;
const FOUR_WEEKS_DAYS = 28;
const MAX_RECENT_ITEMS = 12;
const ALLERGEN_CATEGORY_NAME = "Allergènes majeurs";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLERGEN_TABLE_MAX_LINE_LENGTH = 92;
const ALLERGEN_TABLE_COLUMNS = {
  foodName: 14,
  status: 8,
  lastExposure: 12,
  reaction: 29
} as const;
const HISTORY_FOOD_NAME_MAX_LENGTH = 16;
const HISTORY_TABLE_MAX_LINE_LENGTH = 92;
const MONOSPACE_PREFIX = "[[MONO]] ";
const HISTORY_TABLE_COLUMNS = {
  date: 10,
  food: 22,
  outcome: 8,
  symptom: 43
} as const;

function toUtcDayTimestamp(isoDate: string) {
  if (!DATE_PATTERN.test(isoDate)) return null;
  const timestamp = Date.parse(`${isoDate}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getDaysAgo(currentDayTimestamp: number, isoDate: string) {
  const entryTimestamp = toUtcDayTimestamp(isoDate);
  if (entryTimestamp === null) return null;
  return Math.floor((currentDayTimestamp - entryTimestamp) / DAY_MS);
}

function formatUtcOffsetLabel(timezoneOffsetMinutes: number) {
  const utcOffsetMinutes = -timezoneOffsetMinutes;
  const sign = utcOffsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(utcOffsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function formatDateTimeForTimezoneOffset(value: Date, timezoneOffsetMinutes: number) {
  const normalizedOffset = normalizeTimezoneOffsetMinutes(timezoneOffsetMinutes, 0);
  const localDate = new Date(value.getTime() - normalizedOffset * 60_000);
  const iso = localDate.toISOString();
  return `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)} (${formatUtcOffsetLabel(normalizedOffset)})`;
}

function getPercentLabel(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function getAgeInMonths(birthDate: string | null, nowIsoDate: string) {
  if (!birthDate) return null;
  if (!DATE_PATTERN.test(birthDate)) return null;
  if (!DATE_PATTERN.test(nowIsoDate)) return null;

  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = nowIsoDate.split("-").map(Number);
  if ([birthYear, birthMonth, birthDay, nowYear, nowMonth, nowDay].some((part) => !Number.isFinite(part))) {
    return null;
  }

  let months = (nowYear - birthYear) * 12 + (nowMonth - birthMonth);
  if (nowDay < birthDay) {
    months -= 1;
  }

  return months < 0 ? null : months;
}

function buildTrendLabel(currentValue: number, previousValue: number) {
  const delta = currentValue - previousValue;

  if (previousValue <= 0) {
    if (currentValue <= 0) return "stable (aucune dégustation sur les deux périodes)";
    return `nouvelle dynamique (+${currentValue} dégustations)`;
  }

  const percent = Math.round((delta / previousValue) * 100);
  if (delta > 0) return `hausse de ${delta} dégustations (+${percent}%)`;
  if (delta < 0) return `baisse de ${Math.abs(delta)} dégustations (${percent}%)`;
  return "stable (même volume de dégustations)";
}

function buildRiskSignals(params: {
  ageInMonths: number | null;
  daysSinceLastTasting: number | null;
  recentTastingsCount: number;
  recentReactionCounts: Map<number, number>;
  allergenTotal: number;
  allergenIntroduced: number;
}): RiskSignal[] {
  const {
    ageInMonths,
    daysSinceLastTasting,
    recentTastingsCount,
    recentReactionCounts,
    allergenTotal,
    allergenIntroduced
  } = params;

  const signals: RiskSignal[] = [];
  const respiratoryCount = recentReactionCounts.get(4) || 0;
  const digestiveHighCount = recentReactionCounts.get(3) || 0;
  const totalReactions = [...recentReactionCounts.values()].reduce((sum, count) => sum + count, 0);

  if (respiratoryCount > 0) {
    signals.push({
      level: "ALERTE",
      title: "Réaction respiratoire récente",
      detail: `${respiratoryCount} épisode(s) respiratoire(s) observé(s) sur 14 jours.`
    });
  }

  if (digestiveHighCount >= 2) {
    signals.push({
      level: "VIGILANCE",
      title: "Vomissements/réactions digestives hautes répétées",
      detail: `${digestiveHighCount} épisode(s) digestif(s) haut(s) sur 14 jours.`
    });
  }

  if (totalReactions >= 3) {
    signals.push({
      level: "VIGILANCE",
      title: "Fréquence élevée de symptômes",
      detail: `${totalReactions} symptômes non nuls sur les 14 derniers jours.`
    });
  }

  if (daysSinceLastTasting !== null && daysSinceLastTasting >= 10) {
    signals.push({
      level: "VIGILANCE",
      title: "Ralentissement de la progression",
      detail: `Dernière dégustation il y a ${daysSinceLastTasting} jour(s).`
    });
  }

  if (recentTastingsCount > 0 && recentTastingsCount < 4) {
    signals.push({
      level: "INFO",
      title: "Cadence de dégustation modérée",
      detail: `${recentTastingsCount} dégustation(s) sur 14 jours.`
    });
  }

  if (allergenTotal > 0 && ageInMonths !== null && ageInMonths >= 8 && allergenIntroduced < 4) {
    signals.push({
      level: "VIGILANCE",
      title: "Allergènes majeurs peu introduits",
      detail: `${allergenIntroduced}/${allergenTotal} allergènes introduits.`
    });
  }

  if (signals.length === 0) {
    signals.push({
      level: "INFO",
      title: "Aucun signal fort détecté sur 14 jours",
      detail: "La dynamique semble régulière sur la période récente."
    });
  }

  return signals;
}

function getRecentReactionSummary(recentReactionCounts: Map<number, number>) {
  const entries = [...recentReactionCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "Aucun symptôme noté sur 14 jours.";

  return entries
    .map(([reactionType, count]) => {
      const reaction = getReactionOption(reactionType as 0 | 1 | 2 | 3 | 4);
      const label = reaction?.label || `Type ${reactionType}`;
      return `${label}: ${count}`;
    })
    .join(" | ");
}

function getAllergenLastExposureDate(tastings: FoodTastingEntry[]) {
  let latestTimestamp = -1;
  let latestIsoDate = "";

  for (const tasting of tastings) {
    const timestamp = toUtcDayTimestamp(tasting.tastedOn);
    if (timestamp === null) continue;
    if (timestamp <= latestTimestamp) continue;
    latestTimestamp = timestamp;
    latestIsoDate = tasting.tastedOn;
  }

  if (!latestIsoDate) return "-";
  return formatDate(latestIsoDate);
}

function getAllergenMaxReactionType(tastings: FoodTastingEntry[]) {
  let reactionMax: number | null = null;

  for (const tasting of tastings) {
    const reactionType = tasting.reactionType;
    if (typeof reactionType !== "number" || reactionType <= 0) continue;
    if (reactionMax === null || reactionType > reactionMax) {
      reactionMax = reactionType;
    }
  }

  return reactionMax;
}

function getAllergenReactionLabel(reactionMax: number | null) {
  if (reactionMax === null) return "Aucun symptôme";
  const option = getReactionOption(reactionMax as 0 | 1 | 2 | 3 | 4);
  if (option) return option.label;
  return `Type ${reactionMax}`;
}

function getAllergenVigilanceNote(params: {
  reactionMax: number | null;
  exposureCount: number;
  ageInMonths: number | null;
}) {
  const { reactionMax, exposureCount, ageInMonths } = params;

  if (reactionMax === 4) return "ALERTE respiratoire - avis médical rapide";
  if (reactionMax === 3) return "VIGILANCE digestive haute - discuter en consultation";
  if (exposureCount === 0 && ageInMonths !== null && ageInMonths >= 8) return "A introduire progressivement";
  if (exposureCount < 3 && ageInMonths !== null && ageInMonths >= 10) return "Poursuivre expositions régulières";
  return "Suivi standard";
}

function buildAllergenRows(allergenFoods: DashboardCategory["foods"], ageInMonths: number | null) {
  return allergenFoods.map((food): AllergenReportRow => {
    const exposureCount = Math.min(3, Math.max(0, Math.trunc(food.tastingCount)));
    const reactionMax = getAllergenMaxReactionType(food.tastings);

    return {
      foodName: food.name,
      exposureCount,
      lastExposureLabel: getAllergenLastExposureDate(food.tastings),
      reactionMax,
      reactionMaxLabel: getAllergenReactionLabel(reactionMax),
      vigilanceNote: getAllergenVigilanceNote({
        reactionMax,
        exposureCount,
        ageInMonths
      })
    };
  });
}

function truncateWithEllipsis(value: string, maxLength: number) {
  const sanitized = String(value || "").trim();
  if (maxLength <= 0) return "";
  if (sanitized.length <= maxLength) return sanitized;
  if (maxLength <= 3) return ".".repeat(maxLength);
  return `${sanitized.slice(0, maxLength - 3)}...`;
}

function padRight(value: string, width: number) {
  const normalized = truncateWithEllipsis(value, width);
  if (normalized.length >= width) return normalized;
  return normalized.padEnd(width, " ");
}

function buildAllergenTableLine(cells: [string, string, string, string]) {
  const line = [
    padRight(cells[0], ALLERGEN_TABLE_COLUMNS.foodName),
    padRight(cells[1], ALLERGEN_TABLE_COLUMNS.status),
    padRight(cells[2], ALLERGEN_TABLE_COLUMNS.lastExposure),
    padRight(cells[3], ALLERGEN_TABLE_COLUMNS.reaction)
  ].join(" | ");
  return `${MONOSPACE_PREFIX}${line.slice(0, ALLERGEN_TABLE_MAX_LINE_LENGTH)}`;
}

function buildAllergenTableLines(allergenRows: AllergenReportRow[]) {
  const headerLine = buildAllergenTableLine(["Allergène", "Statut", "Dernière", "Réaction"]);
  const separatorLine = buildAllergenTableLine(["----------", "------", "-------", "--------"]);
  const rows: string[] = [headerLine, separatorLine];

  for (const row of allergenRows) {
    const statusLabel = `${row.exposureCount}/3`;
    const reactionLabel = row.reactionMaxLabel;

    rows.push(buildAllergenTableLine([row.foodName, statusLabel, row.lastExposureLabel, reactionLabel]));
  }

  return rows;
}

function buildAllergenAlertLines(allergenRows: AllergenReportRow[]) {
  return allergenRows
    .filter((row) => row.vigilanceNote.startsWith("ALERTE"))
    .map((row) =>
      truncateWithEllipsis(
        `- Vigilance: ${row.vigilanceNote} (${row.foodName})`,
        ALLERGEN_TABLE_MAX_LINE_LENGTH
      )
    );
}

function buildHistoryTableLine(cells: [string, string, string, string]) {
  const line = [
    padRight(cells[0], HISTORY_TABLE_COLUMNS.date),
    padRight(cells[1], HISTORY_TABLE_COLUMNS.food),
    padRight(cells[2], HISTORY_TABLE_COLUMNS.outcome),
    padRight(cells[3], HISTORY_TABLE_COLUMNS.symptom)
  ].join(" | ");
  return `${MONOSPACE_PREFIX}${line.slice(0, HISTORY_TABLE_MAX_LINE_LENGTH)}`;
}

function buildRecentHistoryTableLines(entries: FoodTimelineEntry[]) {
  if (entries.length === 0) return ["- Aucun enregistrement sur les 14 derniers jours."];

  const lines = [
    buildHistoryTableLine(["Date", "Aliment", "Avis", "Symptôme"]),
    buildHistoryTableLine(["----", "-------", "----", "--------"])
  ];

  for (const entry of entries.slice(0, MAX_RECENT_ITEMS)) {
    const reaction = getReactionOption((entry.reactionType ?? 0) as 0 | 1 | 2 | 3 | 4);
    const reactionLabel = reaction?.label || "Aucun symptôme";
    const outcomeLabel = entry.liked === true ? "aimé" : entry.liked === false ? "refusé" : "indécis";
    const foodNameLabel = truncateWithEllipsis(entry.foodName, HISTORY_FOOD_NAME_MAX_LENGTH);
    const foodWithSlot = `${foodNameLabel} (${entry.slot}/3)`;
    lines.push(buildHistoryTableLine([formatDate(entry.tastedOn), foodWithSlot, outcomeLabel, reactionLabel]));
  }

  return lines;
}

export function buildPediatricReportLines({
  childProfile,
  categories,
  timelineEntries,
  generatedAt = new Date(),
  timezoneOffsetMinutes = 0
}: PediatricReportInput) {
  const normalizedTimezoneOffset = normalizeTimezoneOffsetMinutes(timezoneOffsetMinutes, 0);
  const currentIsoDate = getIsoDateForTimezoneOffset(normalizedTimezoneOffset);
  const currentDayTimestamp = toUtcDayTimestamp(currentIsoDate) || Date.now();

  const foods = categories.flatMap((category) => category.foods);
  const totalFoods = foods.length;
  const introducedFoods = foods.filter((food) => food.tastingCount > 0).length;
  const completedFoods = foods.filter((food) => food.tastingCount >= 3).length;
  const inProgressFoods = foods.filter((food) => food.tastingCount > 0 && food.tastingCount < 3).length;
  const finalLikedFoods = foods.filter((food) => food.finalPreference === 1).length;
  const finalRejectedFoods = foods.filter((food) => food.finalPreference === -1).length;

  const sortedTimeline = [...timelineEntries].sort((a, b) => {
    const aTimestamp = toUtcDayTimestamp(a.tastedOn) || 0;
    const bTimestamp = toUtcDayTimestamp(b.tastedOn) || 0;
    if (aTimestamp !== bTimestamp) return bTimestamp - aTimestamp;
    if (a.slot !== b.slot) return b.slot - a.slot;
    return a.foodName.localeCompare(b.foodName, "fr");
  });

  const recentEntries = sortedTimeline.filter((entry) => {
    const daysAgo = getDaysAgo(currentDayTimestamp, entry.tastedOn);
    return daysAgo !== null && daysAgo >= 0 && daysAgo < RECENT_DAYS;
  });

  const previousEntries = sortedTimeline.filter((entry) => {
    const daysAgo = getDaysAgo(currentDayTimestamp, entry.tastedOn);
    return daysAgo !== null && daysAgo >= RECENT_DAYS && daysAgo < RECENT_DAYS + PREVIOUS_WINDOW_DAYS;
  });

  const fourWeekEntries = sortedTimeline.filter((entry) => {
    const daysAgo = getDaysAgo(currentDayTimestamp, entry.tastedOn);
    return daysAgo !== null && daysAgo >= 0 && daysAgo < FOUR_WEEKS_DAYS;
  });

  const distinctRecentFoods = new Set(recentEntries.map((entry) => entry.foodId)).size;
  const distinctPreviousFoods = new Set(previousEntries.map((entry) => entry.foodId)).size;

  const decidedRecentEntries = recentEntries.filter((entry) => entry.liked !== null);
  const decidedTimelineEntries = sortedTimeline.filter((entry) => entry.liked !== null);
  const likedRecentCount = decidedRecentEntries.filter((entry) => entry.liked === true).length;
  const likedTotalCount = decidedTimelineEntries.filter((entry) => entry.liked === true).length;

  const recentReactionCounts = new Map<number, number>();
  for (const entry of recentEntries) {
    const reactionType = entry.reactionType ?? 0;
    if (reactionType <= 0) continue;
    recentReactionCounts.set(reactionType, (recentReactionCounts.get(reactionType) || 0) + 1);
  }

  const earliestByFoodId = new Map<number, number>();
  for (const entry of sortedTimeline) {
    const timestamp = toUtcDayTimestamp(entry.tastedOn);
    if (timestamp === null) continue;
    const existing = earliestByFoodId.get(entry.foodId);
    if (existing === undefined || timestamp < existing) {
      earliestByFoodId.set(entry.foodId, timestamp);
    }
  }

  let newFoodsRecent = 0;
  let newFoodsPrevious = 0;
  for (const timestamp of earliestByFoodId.values()) {
    const daysAgo = Math.floor((currentDayTimestamp - timestamp) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < RECENT_DAYS) {
      newFoodsRecent += 1;
      continue;
    }
    if (daysAgo >= RECENT_DAYS && daysAgo < RECENT_DAYS + PREVIOUS_WINDOW_DAYS) {
      newFoodsPrevious += 1;
    }
  }

  const lastEntry = sortedTimeline[0] || null;
  const daysSinceLastTasting = lastEntry ? getDaysAgo(currentDayTimestamp, lastEntry.tastedOn) : null;
  const pacePerWeek = (fourWeekEntries.length / 4).toFixed(1);
  const ageInMonths = getAgeInMonths(childProfile?.birthDate || null, currentIsoDate);

  const allergenCategory = categories.find((category) => category.name === ALLERGEN_CATEGORY_NAME);
  const allergenFoods = allergenCategory?.foods || [];
  const allergenTotal = allergenFoods.length;
  const allergenIntroduced = allergenFoods.filter((food) => food.tastingCount > 0).length;
  const allergenCompleted = allergenFoods.filter((food) => food.tastingCount >= 3).length;
  const allergenRows = buildAllergenRows(allergenFoods, ageInMonths);
  const allergenWithSymptoms = allergenRows.filter((row) => row.reactionMax !== null).length;
  const allergenAlertLines = buildAllergenAlertLines(allergenRows);

  const riskSignals = buildRiskSignals({
    ageInMonths,
    daysSinceLastTasting,
    recentTastingsCount: recentEntries.length,
    recentReactionCounts,
    allergenTotal,
    allergenIntroduced
  });

  const firstName = childProfile?.firstName?.trim() || "Bébé";
  const birthDateLabel = childProfile?.birthDate ? formatDate(childProfile.birthDate) : "Non renseignée";
  const ageLabel = ageInMonths === null ? "Non renseigné" : `${ageInMonths} mois`;
  const latestTastingLabel = lastEntry
    ? `${formatDate(lastEntry.tastedOn)} (${daysSinceLastTasting ?? 0} jour(s))`
    : "Aucune dégustation enregistrée";

  const lines: string[] = [
    "Document professionnel - consultation pédiatrique",
    `Date du rapport: ${formatDateTimeForTimezoneOffset(generatedAt, normalizedTimezoneOffset)}`,
    `Référence temporelle: ${formatUtcOffsetLabel(normalizedTimezoneOffset)}`,
    "",
    "1) Identité enfant",
    `- Prénom: ${firstName}`,
    `- Date de naissance: ${birthDateLabel}`,
    `- Âge: ${ageLabel}`,
    "",
    "2) Vue globale diversification",
    `- Aliments testés: ${introducedFoods}/${totalFoods} (${getPercentLabel(introducedFoods, totalFoods)})`,
    `- Aliments consolidés (3/3): ${completedFoods}`,
    `- Aliments en cours (1-2/3): ${inProgressFoods}`,
    `- Acceptation globale (hors indécis): ${likedTotalCount}/${decidedTimelineEntries.length} (${getPercentLabel(likedTotalCount, decidedTimelineEntries.length)})`,
    `- Préférence finale: ${finalLikedFoods} aimé(s), ${finalRejectedFoods} refusé(s)`,
    "",
    "3) Dynamique récente",
    `- Derniers 14 jours: ${recentEntries.length} dégustation(s), ${distinctRecentFoods} aliment(s) distinct(s)`,
    `- 14 jours précédents: ${previousEntries.length} dégustation(s), ${distinctPreviousFoods} aliment(s) distinct(s)`,
    `- Évolution: ${buildTrendLabel(recentEntries.length, previousEntries.length)}`,
    `- Nouveaux aliments: ${newFoodsRecent} (vs ${newFoodsPrevious} sur la période précédente)`,
    `- Cadence 4 semaines: ${pacePerWeek} dégustation(s)/semaine`,
    `- Dernière dégustation: ${latestTastingLabel}`,
    `- Symptômes 14 jours: ${getRecentReactionSummary(recentReactionCounts)}`,
    `- Acceptation 14 jours (hors indécis): ${likedRecentCount}/${decidedRecentEntries.length} (${getPercentLabel(likedRecentCount, decidedRecentEntries.length)})`,
    "",
    " ",
    "4) Tableau allergènes majeurs (consultation)",
    allergenTotal > 0
      ? `- Introduits: ${allergenIntroduced}/${allergenTotal} (${getPercentLabel(allergenIntroduced, allergenTotal)})`
      : "- Catégorie allergènes indisponible",
    allergenTotal > 0 ? `- Consolidés (3/3): ${allergenCompleted}/${allergenTotal}` : "",
    allergenTotal > 0 ? `- Avec symptôme observé: ${allergenWithSymptoms}/${allergenTotal}` : "",
    ...(allergenTotal > 0 ? buildAllergenTableLines(allergenRows) : []),
    ...(allergenAlertLines.length > 0 ? ["", "Vigilances ALERTE:", ...allergenAlertLines] : []),
    "",
    "5) Signaux de vigilance à discuter",
    ...riskSignals.map((signal) => `- [${signal.level}] ${signal.title}: ${signal.detail}`),
    "",
    "6) Historique récent (max 12 entrées)",
    ...buildRecentHistoryTableLines(recentEntries),
    "",
    "Ce rapport est un support de consultation et ne remplace pas un avis médical.",
    "En cas de réaction respiratoire ou symptôme sévère: contactez rapidement un professionnel de santé."
  ];

  return lines.filter((line, index, source) => {
    if (line) return true;
    return source[index - 1] !== "";
  });
}

export function buildPediatricReportFileName(
  firstName: string | null | undefined,
  generatedAt = new Date(),
  timezoneOffsetMinutes = 0
) {
  const normalizedFirstName = String(firstName || "enfant")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const normalizedTimezoneOffset = normalizeTimezoneOffsetMinutes(timezoneOffsetMinutes, 0);
  const datePart = getIsoDateForTimezoneOffset(normalizedTimezoneOffset);
  const safeFirstName = normalizedFirstName || "enfant";
  return `grrrignote-rapport-pediatre-${safeFirstName}-${datePart}.pdf`;
}
