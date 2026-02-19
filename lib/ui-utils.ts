import type { FinalPreferenceValue } from "@/lib/types";
import { getCurrentIsoDate } from "@/lib/date-utils";

// Date & Time Helpers
export const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
export const FRENCH_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
export const SEARCH_RANK_EXACT_MATCH = 0 as const;
export const SEARCH_RANK_WORD_PREFIX = 1 as const;
export const SEARCH_RANK_CONTAINS = 2 as const;

export type SearchRank =
  | typeof SEARCH_RANK_EXACT_MATCH
  | typeof SEARCH_RANK_WORD_PREFIX
  | typeof SEARCH_RANK_CONTAINS;

export function normalizeSearchValue(value: string) {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase().trim();
}

export function getSearchRank(normalizedName: string, normalizedQuery: string): SearchRank | null {
  if (normalizedQuery.length === 0) return SEARCH_RANK_EXACT_MATCH;
  if (normalizedName.startsWith(normalizedQuery)) return SEARCH_RANK_EXACT_MATCH;
  if (normalizedName.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) {
    return SEARCH_RANK_WORD_PREFIX;
  }
  if (normalizedName.includes(normalizedQuery)) return SEARCH_RANK_CONTAINS;
  return null;
}

export const FRENCH_DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

export function getTodayIsoDate() {
  return getCurrentIsoDate();
}

export function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatTimelineDayLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  const formatted = FRENCH_DAY_FORMATTER.format(parsed);
  const firstChar = formatted.charAt(0);
  return firstChar ? `${firstChar.toUpperCase()}${formatted.slice(1)}` : formatted;
}

export function getTimelineDateTimestamp(value: string) {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

export function getUpdatedTimestamp(updatedAt: string | null) {
  if (!updatedAt) return 0;
  const parsed = Date.parse(updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Preference Logic Helpers
export function getNextFinalPreference(current: FinalPreferenceValue): FinalPreferenceValue {
  if (current === 0) return 1;
  if (current === 1) return -1;
  return 0;
}

export function getFinalPreferenceLabel(preference: FinalPreferenceValue) {
  if (preference === 1) return "aimé";
  if (preference === -1) return "pas aimé";
  return "neutre";
}

// Visual Helpers
export function getFinalPreferenceImageSrc(preference: FinalPreferenceValue) {
  if (preference === 1) return "/images/preferences/thumb-up.webp";
  if (preference === -1) return "/images/preferences/thumb-down.webp";
  return "/images/preferences/thumb-neutral.webp";
}

export function getFinalPreferenceVisualClass(preference: FinalPreferenceValue) {
  if (preference === 1) return "border-emerald-500";
  if (preference === -1) return "border-rose-500";
  return "border-[#b9ac9b]";
}

export function getTimelineTigerIcon(liked: boolean) {
  return liked ? "/images/reactions/smiley-ok.webp" : "/images/reactions/smiley-ko.webp";
}

export function getFinalTimelineToneClass(preference: FinalPreferenceValue) {
  if (preference === 1) return "food-timeline-result-positive";
  if (preference === -1) return "food-timeline-result-negative";
  return "food-timeline-result-neutral";
}
