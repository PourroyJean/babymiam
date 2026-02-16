"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setFinalPreferenceAction } from "@/app/actions";
import { FoodSummaryModal } from "@/components/food-summary-modal";
import { QuickAddPanel } from "@/components/quick-add-panel";
import { VegetableRow } from "@/components/vegetable-row";
import { getCategoryUi } from "@/lib/category-ui";
import type { DashboardCategory, DashboardFood, FoodTimelineEntry } from "@/lib/types";

type CategoriesGridProps = {
  categories: DashboardCategory[];
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
  timelineEntries: FoodTimelineEntry[];
};

type SearchFood = DashboardFood & {
  categoryId: number;
  categoryName: string;
  normalizedName: string;
};

type QuickAddFood = {
  id: number;
  name: string;
  categoryName: string;
  normalizedName: string;
  exposureCount: number;
};

type FoodIndexEntry = {
  food: DashboardFood;
  categoryName: string;
};

type FinalPreferenceValue = -1 | 0 | 1;
type CategoryKpi = {
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  discoveredCount: number;
  discoveredPercent: number;
  donePercent: number;
};

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const FRENCH_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
const FRENCH_DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const RECENT_FOODS_LIMIT = 15;
const FINAL_PREFERENCE_DEBOUNCE_MS = 2000;

function normalizeSearchValue(value: string) {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase().trim();
}

function getSearchRank(normalizedName: string, normalizedQuery: string) {
  if (normalizedName.startsWith(normalizedQuery)) return 0;
  if (normalizedName.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return Number.POSITIVE_INFINITY;
}

function getUpdatedTimestamp(updatedAt: string | null) {
  if (!updatedAt) return 0;
  const parsed = Date.parse(updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTimelineDateTimestamp(value: string) {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function formatTimelineDayLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  const formatted = FRENCH_DAY_FORMATTER.format(parsed);
  const firstChar = formatted.charAt(0);
  return firstChar ? `${firstChar.toUpperCase()}${formatted.slice(1)}` : formatted;
}

function getFinalPreferenceLabel(preference: -1 | 0 | 1) {
  if (preference === 1) return "Adoré";
  if (preference === -1) return "Pas aimé";
  return "Neutre";
}

function getTimelineTigerIcon(liked: boolean) {
  return liked ? "/smiley_ok.png" : "/smiley_ko.png";
}

function getFinalPreferenceImageSrc(preference: -1 | 0 | 1) {
  if (preference === 1) return "/pouce_YES.png";
  if (preference === -1) return "/pouce_NO.png";
  return "/pouce_NEUTRE.png";
}

function getFinalTimelineToneClass(preference: -1 | 0 | 1) {
  if (preference === 1) return "food-timeline-result-positive";
  if (preference === -1) return "food-timeline-result-negative";
  return "food-timeline-result-neutral";
}

function buildCategoryKpi(foods: DashboardFood[]): CategoryKpi {
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

function getNextFinalPreference(current: FinalPreferenceValue): FinalPreferenceValue {
  if (current === 0) return 1;
  if (current === 1) return -1;
  return 0;
}

function getRedirectUrlFromError(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) return null;

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return null;

  const segments = digest.split(";");
  if (segments[0] !== "NEXT_REDIRECT") return null;

  const redirectUrl = segments.slice(2, -2).join(";");
  return redirectUrl || null;
}

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

export function CategoriesGrid({
  categories,
  toneByCategory,
  childFirstName = null,
  timelineEntries
}: CategoriesGridProps) {
  const [openByCategoryId, setOpenByCategoryId] = useState<Record<number, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [summaryFoodId, setSummaryFoodId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [showTestedOnly, setShowTestedOnly] = useState(false);
  const [finalPreferenceOverridesByFoodId, setFinalPreferenceOverridesByFoodId] = useState<
    Record<number, FinalPreferenceValue>
  >({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const timelineTriggerRef = useRef<HTMLButtonElement>(null);
  const quickAddTriggerRef = useRef<HTMLButtonElement>(null);
  const timelineModalRef = useRef<HTMLElement>(null);
  const timelineCloseRef = useRef<HTMLButtonElement>(null);
  const summaryTriggerRef = useRef<HTMLElement | null>(null);
  const wasSearchOpenRef = useRef(false);
  const wasSummaryOpenRef = useRef(false);
  const summaryFoodIdRef = useRef<number | null>(null);
  const finalPreferenceOverridesRef = useRef<Record<number, FinalPreferenceValue>>({});
  const serverFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());
  const wasTimelineOpenRef = useRef(false);
  const wasQuickAddOpenRef = useRef(false);
  const debounceTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pendingFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());
  const inFlightFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());

  function toggleCategory(categoryId: number) {
    setOpenByCategoryId((current) => ({
      ...current,
      [categoryId]: !current[categoryId]
    }));
  }

  function isCategoryOpen(categoryId: number) {
    return Boolean(openByCategoryId[categoryId]);
  }

  function closeSearch() {
    setIsSearchOpen(false);
    setQuery("");
  }

  function openSearch() {
    setIsTimelineOpen(false);
    setIsQuickAddOpen(false);
    setIsSearchOpen(true);
  }

  function closeTimeline() {
    setIsTimelineOpen(false);
  }

  function openTimeline() {
    setIsSearchOpen(false);
    setQuery("");
    setIsQuickAddOpen(false);
    setIsTimelineOpen(true);
  }

  function closeQuickAdd() {
    setIsQuickAddOpen(false);
  }

  function openQuickAdd() {
    setIsSearchOpen(false);
    setQuery("");
    setIsTimelineOpen(false);
    setIsQuickAddOpen(true);
  }

  const isSummaryOpen = summaryFoodId !== null;

  const openFoodSummary = useCallback((foodId: number, triggerEl: HTMLElement) => {
    summaryTriggerRef.current = triggerEl;
    setSummaryFoodId(foodId);
  }, []);

  const closeFoodSummary = useCallback(() => {
    setSummaryFoodId(null);
  }, []);

  const serverFinalPreferenceByFoodId = useMemo(() => {
    const preferenceMap = new Map<number, FinalPreferenceValue>();

    for (const category of categories) {
      for (const food of category.foods) {
        preferenceMap.set(food.id, food.finalPreference);
      }
    }

    return preferenceMap;
  }, [categories]);

  useEffect(() => {
    serverFinalPreferenceByFoodIdRef.current = serverFinalPreferenceByFoodId;
  }, [serverFinalPreferenceByFoodId]);

  useEffect(() => {
    finalPreferenceOverridesRef.current = finalPreferenceOverridesByFoodId;
  }, [finalPreferenceOverridesByFoodId]);

  useEffect(() => {
    summaryFoodIdRef.current = summaryFoodId;
  }, [summaryFoodId]);

  useEffect(() => {
    if (isSummaryOpen) {
      wasSummaryOpenRef.current = true;
      return;
    }

    if (!wasSummaryOpenRef.current) return;

    const trigger = summaryTriggerRef.current;
    summaryTriggerRef.current = null;
    wasSummaryOpenRef.current = false;
    trigger?.focus();
  }, [isSummaryOpen]);

  const removeFinalPreferenceOverride = useCallback((foodId: number) => {
    setFinalPreferenceOverridesByFoodId((current) => {
      if (!(foodId in current)) return current;

      const next = { ...current };
      delete next[foodId];
      finalPreferenceOverridesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    setFinalPreferenceOverridesByFoodId((current) => {
      let hasChanges = false;
      const next = { ...current };

      for (const [foodIdRaw, value] of Object.entries(current)) {
        const foodId = Number(foodIdRaw);

        if (pendingFinalPreferenceByFoodIdRef.current.has(foodId)) continue;
        if (inFlightFinalPreferenceByFoodIdRef.current.get(foodId) === value) continue;

        const serverValue = serverFinalPreferenceByFoodId.get(foodId);
        if (serverValue === undefined || serverValue === value) {
          delete next[foodId];
          inFlightFinalPreferenceByFoodIdRef.current.delete(foodId);
          hasChanges = true;
          continue;
        }

        // No pending/in-flight write for this value: server is now source of truth.
        if (serverValue !== value) {
          delete next[foodId];
          inFlightFinalPreferenceByFoodIdRef.current.delete(foodId);
          hasChanges = true;
        }
      }

      if (!hasChanges) return current;
      finalPreferenceOverridesRef.current = next;
      return next;
    });
  }, [serverFinalPreferenceByFoodId]);

  const persistFinalPreference = useCallback(async (foodId: number, preference: FinalPreferenceValue) => {
    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("value", String(preference));
    await setFinalPreferenceAction(formData);
  }, []);

  const flushPendingFinalPreference = useCallback(
    (foodId: number) => {
      const existingTimer = debounceTimersRef.current.get(foodId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current.delete(foodId);
      }

      const pendingValue = pendingFinalPreferenceByFoodIdRef.current.get(foodId);
      if (pendingValue === undefined) return;

      pendingFinalPreferenceByFoodIdRef.current.delete(foodId);
      inFlightFinalPreferenceByFoodIdRef.current.set(foodId, pendingValue);

      void persistFinalPreference(foodId, pendingValue)
        .catch((error) => {
          const redirectUrl = getRedirectUrlFromError(error);
          if (redirectUrl) {
            window.location.assign(redirectUrl);
            return;
          }

          removeFinalPreferenceOverride(foodId);
        })
        .finally(() => {
          inFlightFinalPreferenceByFoodIdRef.current.delete(foodId);
        });
    },
    [persistFinalPreference, removeFinalPreferenceOverride]
  );

  const flushAllPendingFinalPreferences = useCallback(() => {
    const pendingFoodIds = Array.from(pendingFinalPreferenceByFoodIdRef.current.keys());
    for (const foodId of pendingFoodIds) {
      flushPendingFinalPreference(foodId);
    }
  }, [flushPendingFinalPreference]);

  const cycleFinalPreference = useCallback(
    (foodId: number) => {
      const serverPreference = serverFinalPreferenceByFoodIdRef.current.get(foodId) ?? 0;
      const currentPreference = finalPreferenceOverridesRef.current[foodId] ?? serverPreference;
      const nextPreference = getNextFinalPreference(currentPreference);

      const nextOverrides = {
        ...finalPreferenceOverridesRef.current,
        [foodId]: nextPreference
      };

      finalPreferenceOverridesRef.current = nextOverrides;
      setFinalPreferenceOverridesByFoodId(nextOverrides);
      pendingFinalPreferenceByFoodIdRef.current.set(foodId, nextPreference);

      const existingTimer = debounceTimersRef.current.get(foodId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timerId = setTimeout(() => {
        flushPendingFinalPreference(foodId);
      }, FINAL_PREFERENCE_DEBOUNCE_MS);

      debounceTimersRef.current.set(foodId, timerId);
    },
    [flushPendingFinalPreference]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsTimelineOpen(false);
        setIsQuickAddOpen(false);
        setIsSearchOpen(true);
        return;
      }

      if (event.key === "Escape") {
        if (summaryFoodIdRef.current !== null) {
          event.preventDefault();
          setSummaryFoodId(null);
          return;
        }

        setIsSearchOpen(false);
        setQuery("");
        setIsTimelineOpen(false);
        setIsQuickAddOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;

    function onPageHide() {
      flushAllPendingFinalPreferences();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushAllPendingFinalPreferences();
      }
    }

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushAllPendingFinalPreferences();

      for (const timerId of debounceTimers.values()) {
        clearTimeout(timerId);
      }
      debounceTimers.clear();
    };
  }, [flushAllPendingFinalPreferences]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isSearchOpen]);

  useEffect(() => {
    if (isTimelineOpen) {
      wasTimelineOpenRef.current = true;
      return;
    }

    if (wasTimelineOpenRef.current) {
      timelineTriggerRef.current?.focus();
      wasTimelineOpenRef.current = false;
    }
  }, [isTimelineOpen]);

  useEffect(() => {
    if (!isTimelineOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      timelineCloseRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isTimelineOpen]);

  useEffect(() => {
    if (!isTimelineOpen || isSummaryOpen) return;

    function trapTimelineFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const modal = timelineModalRef.current;
      if (!modal) return;

      const focusableElements = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement || !modal.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", trapTimelineFocus);
    return () => document.removeEventListener("keydown", trapTimelineFocus);
  }, [isTimelineOpen, isSummaryOpen]);

  useEffect(() => {
    if (isQuickAddOpen) {
      wasQuickAddOpenRef.current = true;
      return;
    }

    if (wasQuickAddOpenRef.current) {
      quickAddTriggerRef.current?.focus();
      wasQuickAddOpenRef.current = false;
    }
  }, [isQuickAddOpen]);

  useEffect(() => {
    const hasOverlayOpen = isSearchOpen || isTimelineOpen || isQuickAddOpen || isSummaryOpen;
    if (!hasOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchOpen, isTimelineOpen, isQuickAddOpen, isSummaryOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      wasSearchOpenRef.current = true;
      return;
    }

    if (wasSearchOpenRef.current) {
      searchTriggerRef.current?.focus();
      wasSearchOpenRef.current = false;
    }
  }, [isSearchOpen]);

  const normalizedQuery = useMemo(() => normalizeSearchValue(query), [query]);

  const visibleCategories = useMemo(() => {
    if (!showTestedOnly) return categories;

    return categories
      .map((category) => ({
        ...category,
        foods: category.foods.filter((food) => food.tastingCount > 0)
      }))
      .filter((category) => category.foods.length > 0);
  }, [categories, showTestedOnly]);

  const foodIndexById = useMemo(() => {
    const index = new Map<number, FoodIndexEntry>();

    for (const category of categories) {
      for (const food of category.foods) {
        index.set(food.id, { food, categoryName: category.name });
      }
    }

    return index;
  }, [categories]);

  useEffect(() => {
    if (summaryFoodId === null) return;
    if (foodIndexById.has(summaryFoodId)) return;
    setSummaryFoodId(null);
  }, [foodIndexById, summaryFoodId]);

  const searchableFoods = useMemo<SearchFood[]>(
    () =>
      visibleCategories.flatMap((category) =>
        category.foods.map((food) => ({
          ...food,
          categoryId: category.id,
          categoryName: category.name,
          normalizedName: normalizeSearchValue(food.name)
        }))
      ),
    [visibleCategories]
  );

  const recentFoods = useMemo(
    () =>
      searchableFoods
        .filter((food) => food.updatedAt)
        .sort((a, b) => {
          const updatedDiff = getUpdatedTimestamp(b.updatedAt) - getUpdatedTimestamp(a.updatedAt);
          if (updatedDiff !== 0) return updatedDiff;
          return FRENCH_COLLATOR.compare(a.name, b.name);
        })
        .slice(0, RECENT_FOODS_LIMIT),
    [searchableFoods]
  );

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return recentFoods;

    return searchableFoods
      .map((food) => ({
        food,
        rank: getSearchRank(food.normalizedName, normalizedQuery)
      }))
      .filter((entry) => Number.isFinite(entry.rank))
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return FRENCH_COLLATOR.compare(a.food.name, b.food.name);
      })
      .map((entry) => entry.food);
  }, [normalizedQuery, recentFoods, searchableFoods]);

  const quickAddEligibleFoods = useMemo<QuickAddFood[]>(
    () =>
      categories.flatMap((category) =>
        category.foods
          .filter((food) => food.tastingCount < 3)
          .map((food) => ({
            id: food.id,
            name: food.name,
            categoryName: category.name,
            normalizedName: normalizeSearchValue(food.name),
            exposureCount: food.tastingCount
          }))
      ),
    [categories]
  );

  const isQueryEmpty = normalizedQuery.length === 0;

  const finalPreferenceByFoodId = useMemo(() => {
    const preferenceMap = new Map<number, -1 | 0 | 1>();

    for (const category of categories) {
      for (const food of category.foods) {
        preferenceMap.set(food.id, finalPreferenceOverridesByFoodId[food.id] ?? food.finalPreference);
      }
    }

    return preferenceMap;
  }, [categories, finalPreferenceOverridesByFoodId]);

  const sortedTimelineEntries = useMemo(
    () =>
      [...timelineEntries].sort((a, b) => {
        const dateDiff = getTimelineDateTimestamp(b.tastedOn) - getTimelineDateTimestamp(a.tastedOn);
        if (dateDiff !== 0) return dateDiff;
        if (a.slot !== b.slot) return b.slot - a.slot;
        return FRENCH_COLLATOR.compare(a.foodName, b.foodName);
      }),
    [timelineEntries]
  );

  const timelineGroups = useMemo(() => {
    const groups: Array<{ day: string; label: string; entries: FoodTimelineEntry[] }> = [];
    const groupIndexByDay = new Map<string, number>();

    for (const entry of sortedTimelineEntries) {
      const existingIndex = groupIndexByDay.get(entry.tastedOn);
      if (existingIndex !== undefined) {
        groups[existingIndex].entries.push(entry);
        continue;
      }

      groupIndexByDay.set(entry.tastedOn, groups.length);
      groups.push({
        day: entry.tastedOn,
        label: formatTimelineDayLabel(entry.tastedOn),
        entries: [entry]
      });
    }

    return groups;
  }, [sortedTimelineEntries]);

  const normalizedFirstName = childFirstName?.trim() || "";
  const timelineTitle = normalizedFirstName ? `Carnets de bords de ${normalizedFirstName}` : "Carnets de bords";

  const summaryEntry = summaryFoodId !== null ? foodIndexById.get(summaryFoodId) ?? null : null;
  const summaryFood = summaryEntry?.food ?? null;
  const summaryCategoryName = summaryEntry?.categoryName ?? "";
  const summaryToneClass = toneByCategory[summaryCategoryName] || "tone-other";
  const summaryFinalPreference =
    summaryFoodId !== null ? (finalPreferenceOverridesByFoodId[summaryFoodId] ?? summaryFood?.finalPreference ?? 0) : 0;

  return (
    <section className="categories-section">
      <div className="categories-toolbar">
        <section className="toolbox-card">
          <div className="categories-toolbar-actions">
            <button
              ref={searchTriggerRef}
              type="button"
              className="search-trigger-btn"
              onClick={openSearch}
            >
              <span>Rechercher un aliment</span>
              <span className="search-trigger-shortcut" aria-hidden="true">
                ⌘/Ctrl + K
              </span>
            </button>

            <button ref={timelineTriggerRef} type="button" className="timeline-trigger-btn" onClick={openTimeline}>
              <span>Carnets de bords</span>
            </button>

            <button ref={quickAddTriggerRef} type="button" className="quick-add-trigger-btn" onClick={openQuickAdd}>
              <span>Ajout rapide</span>
            </button>

            <label className="toolbox-toggle">
              <input
                type="checkbox"
                role="switch"
                className="toolbox-toggle-input"
                checked={showTestedOnly}
                onChange={(event) => setShowTestedOnly(event.currentTarget.checked)}
                aria-label="Afficher seulement les aliments déjà testés"
              />
              <span className="toolbox-toggle-track" aria-hidden="true">
                <span className="toolbox-toggle-thumb" />
              </span>
              <span className="toolbox-toggle-text">Afficher seulement les aliments déjà testés</span>
            </label>
          </div>
        </section>
      </div>

      <section className="categories-grid">
        {visibleCategories.length === 0 ? (
          <section className="categories-empty-state" aria-live="polite">
            Aucun aliment déjà testé pour le moment.
          </section>
        ) : null}

        {visibleCategories.map((category, categoryIndex) => {
          const categoryPictogram = getCategoryPictogram(category.name);
          const isOpen = isCategoryOpen(category.id);
          const categoryKpi = buildCategoryKpi(category.foods);
          const roundedDiscoveredPercent = Math.round(categoryKpi.discoveredPercent);
          const kpiBarAriaLabel = `${categoryKpi.discoveredCount}/${categoryKpi.totalCount} découverts (${roundedDiscoveredPercent}%), dont ${categoryKpi.doneCount}/${categoryKpi.totalCount} terminés.`;

          return (
            <article
              key={category.id}
              className={`category-card ${toneByCategory[category.name] || "tone-other"} rounded-3xl`}
            >
              <h3 className="category-title">
                <button
                  type="button"
                  className="category-pill category-toggle touch-manipulation min-h-[44px]"
                  aria-expanded={isOpen}
                  title={isOpen ? "Replier la catégorie" : "Dérouler la catégorie"}
                  onClick={() => toggleCategory(category.id)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">{categoryPictogram}</span>
                    <span>{category.name}</span>
                  </span>
                  <span className="category-toggle-icon" aria-hidden="true">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </button>
              </h3>

              {isOpen ? (
                <ul className="category-list open">
                  {category.foods.map((food) => (
                    <VegetableRow
                      key={food.id}
                      foodId={food.id}
                      name={food.name}
                      tastings={food.tastings}
                      tastingCount={food.tastingCount}
                      finalPreference={finalPreferenceOverridesByFoodId[food.id] ?? food.finalPreference}
                      onCycleFinalPreference={cycleFinalPreference}
                      onOpenFoodSummary={openFoodSummary}
                      childFirstName={childFirstName}
                    />
                  ))}
                </ul>
              ) : (
                <section className="category-kpi" aria-label={`Résumé ${category.name}`}>
                  <div className="category-kpi-head">
                    <p className="category-kpi-label">Progression</p>
                    <p className="category-kpi-percent" aria-label={`${roundedDiscoveredPercent}% découverts`}>
                      {roundedDiscoveredPercent}%
                    </p>
                  </div>
                  <div className="category-kpi-bar" role="img" aria-label={kpiBarAriaLabel}>
                    <div
                      className="category-kpi-fill category-kpi-fill-discovered"
                      style={{ width: `${categoryKpi.discoveredPercent}%` }}
                      aria-hidden="true"
                    />
                    <div
                      className="category-kpi-fill category-kpi-fill-done"
                      style={{ width: `${categoryKpi.donePercent}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="category-kpi-stats">
                    <p className="category-kpi-stat">
                      <span>Terminés</span>
                      <strong>
                        {categoryKpi.doneCount}/{categoryKpi.totalCount}
                      </strong>
                    </p>
                    <p className="category-kpi-stat">
                      <span>En cours</span>
                      <strong>
                        {categoryKpi.inProgressCount}/{categoryKpi.totalCount}
                      </strong>
                    </p>
                    <p className="category-kpi-stat">
                      <span>À découvrir</span>
                      <strong>
                        {categoryKpi.todoCount}/{categoryKpi.totalCount}
                      </strong>
                    </p>
                  </div>
                </section>
              )}
            </article>
          );
        })}
      </section>

      {isSearchOpen ? (
        <div className="food-search-overlay" onClick={closeSearch} role="presentation">
          <section
            className="food-search-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-search-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="food-search-header">
              <h2 id="food-search-title">Recherche globale</h2>
              <button
                type="button"
                className="food-search-close"
                aria-label="Fermer la recherche"
                onClick={closeSearch}
              >
                Fermer
              </button>
            </header>

            <input
              ref={searchInputRef}
              type="text"
              className="food-search-input"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Tape un aliment (ex: brocoli)"
              aria-label="Recherche d'aliment"
            />

            <div className="food-search-results">
              {searchResults.length > 0 ? (
                <ul className="food-search-list">
                  {searchResults.map((food) => (
                    <VegetableRow
                      key={`search-${food.id}`}
                      foodId={food.id}
                      name={food.name}
                      tastings={food.tastings}
                      tastingCount={food.tastingCount}
                      finalPreference={finalPreferenceOverridesByFoodId[food.id] ?? food.finalPreference}
                      onCycleFinalPreference={cycleFinalPreference}
                      onOpenFoodSummary={openFoodSummary}
                      childFirstName={childFirstName}
                    />
                  ))}
                </ul>
              ) : (
                <p className="food-search-empty">
                  {isQueryEmpty ? "Aucune modification récente, tape un aliment." : "Aucun aliment trouvé."}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isTimelineOpen ? (
        <div className="food-timeline-overlay" onClick={closeTimeline} role="presentation">
          <section
            ref={timelineModalRef}
            className="food-timeline-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-timeline-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="food-timeline-header">
              <h2 id="food-timeline-title">{timelineTitle}</h2>
              <button
                ref={timelineCloseRef}
                type="button"
                className="food-search-close"
                aria-label="Fermer le carnet de bord"
                onClick={closeTimeline}
              >
                Fermer
              </button>
            </header>

            <div className="food-timeline-content">
              {timelineGroups.length === 0 ? (
                <p className="food-search-empty">
                  Aucune dégustation enregistrée pour le moment. Utilise les tigres 1/2/3 pour démarrer le carnet.
                </p>
              ) : (
                <ol className="food-timeline-day-list">
                  {timelineGroups.map((group) => (
                    <li key={group.day} className="food-timeline-day-item">
                      <h3 className="food-timeline-day-title">{group.label}</h3>
                      <ol className="food-timeline-entry-list">
                        {group.entries.map((entry) => (
                          <li
                            key={`${entry.foodId}-${entry.slot}-${entry.tastedOn}`}
                            className="food-timeline-entry"
                          >
                            <div className="food-timeline-rail-dot" aria-hidden="true" />
                            {(() => {
                              const entryFinalPreference = finalPreferenceByFoodId.get(entry.foodId) ?? 0;

                              return (
                                <article
                                  className={`food-timeline-card ${
                                    entry.slot === 3
                                      ? `food-timeline-card--final ${getFinalTimelineToneClass(entryFinalPreference)}`
                                      : ""
                                  }`}
                                >
                                  <header className="food-timeline-card-header food-timeline-card-header--line">
                                    <div className="food-timeline-one-liner food-timeline-one-liner--compact">
                                      <span
                                        className={`food-timeline-category-pill food-timeline-category-inline food-timeline-category-emoji-pill ${toneByCategory[entry.categoryName] || "tone-other"}`}
                                        title={entry.categoryName}
                                        aria-label={entry.categoryName}
                                        role="img"
                                      >
                                        {getCategoryPictogram(entry.categoryName)}
                                      </span>
                                      <button
                                        type="button"
                                        className="food-timeline-food-name food-timeline-food-name-inline touch-manipulation appearance-none [-webkit-appearance:none] border-0 bg-transparent p-0 text-left underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.99]"
                                        onClick={(event) => openFoodSummary(entry.foodId, event.currentTarget)}
                                        aria-label={`Ouvrir le résumé de ${entry.foodName}`}
                                        title="Résumé"
                                      >
                                        {entry.foodName}
                                      </button>

                                      <span className={`food-timeline-slot-badge slot-${entry.slot}`}>
                                      <Image
                                        src={getTimelineTigerIcon(entry.liked)}
                                        alt=""
                                        aria-hidden="true"
                                        width={20}
                                        height={20}
                                        unoptimized
                                        className="food-timeline-slot-icon"
                                      />
                                      <span>{entry.slot}/3</span>
                                    </span>

                                    {entry.slot === 3 ? (
                                      <span
                                        className="food-timeline-result-inline"
                                        aria-label={`Résultat final : ${getFinalPreferenceLabel(entryFinalPreference)}`}
                                      >
                                        <Image
                                          src={getFinalPreferenceImageSrc(entryFinalPreference)}
                                          alt=""
                                          aria-hidden="true"
                                          width={31}
                                          height={31}
                                          unoptimized
                                          className="food-timeline-result-inline-icon"
                                        />
                                      </span>
                                    ) : null}

                                      {entry.note.trim() ? <span className="food-timeline-note-inline" title={entry.note}>{entry.note}</span> : null}
                                    </div>

                                  </header>
                                </article>
                              );
                            })()}
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <QuickAddPanel isOpen={isQuickAddOpen} foods={quickAddEligibleFoods} onClose={closeQuickAdd} />
      <FoodSummaryModal
        isOpen={summaryFoodId !== null && summaryFood !== null}
        onClose={closeFoodSummary}
        foodId={summaryFoodId ?? 0}
        foodName={summaryFood?.name ?? ""}
        categoryName={summaryCategoryName}
        categoryToneClass={summaryToneClass}
        tastings={summaryFood?.tastings ?? []}
        tastingCount={summaryFood?.tastingCount ?? 0}
        finalPreference={summaryFinalPreference}
        initialNote={summaryFood?.note ?? ""}
        onCycleFinalPreference={cycleFinalPreference}
      />
    </section>
  );
}
