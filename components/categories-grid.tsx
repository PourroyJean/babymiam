"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setFinalPreferenceAction } from "@/app/actions";
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

type FinalPreferenceValue = -1 | 0 | 1;
type AllergenStage = 0 | 1 | 2 | 3;
type AllergenSummary = {
  toTestCount: number;
  inProgressCount: number;
  consolidatedCount: number;
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
const ALLERGEN_CATEGORY_NAME = "Allergènes majeurs";

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

function getPreferenceLabel(preference: -1 | 0 | 1) {
  if (preference === 1) return "Adoré";
  if (preference === -1) return "Pas aimé";
  return "Neutre";
}

function getTimelineTigerIcon(preference: -1 | 0 | 1) {
  if (preference === -1) return "/smiley_ko.png";
  return "/smiley_ok.png";
}

function getAllergenStage(tastingCount: number): AllergenStage {
  const normalizedValue = Math.max(0, Math.trunc(tastingCount));
  if (normalizedValue >= 3) return 3;
  if (normalizedValue === 2) return 2;
  if (normalizedValue === 1) return 1;
  return 0;
}

function buildAllergenSummary(foods: DashboardFood[]): AllergenSummary {
  let toTestCount = 0;
  let inProgressCount = 0;
  let consolidatedCount = 0;

  for (const food of foods) {
    const stage = getAllergenStage(food.tastingCount);

    if (stage === 0) {
      toTestCount += 1;
      continue;
    }

    if (stage === 3) {
      consolidatedCount += 1;
      continue;
    }

    inProgressCount += 1;
  }

  return {
    toTestCount,
    inProgressCount,
    consolidatedCount
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showTestedOnly, setShowTestedOnly] = useState(false);
  const [finalPreferenceOverridesByFoodId, setFinalPreferenceOverridesByFoodId] = useState<
    Record<number, FinalPreferenceValue>
  >({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const timelineTriggerRef = useRef<HTMLButtonElement>(null);
  const timelineModalRef = useRef<HTMLElement>(null);
  const timelineCloseRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpenRef = useRef(false);
  const finalPreferenceOverridesRef = useRef<Record<number, FinalPreferenceValue>>({});
  const serverFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());
  const wasTimelineOpenRef = useRef(false);
  const debounceTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pendingFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());
  const inFlightFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());

  function toggleCategory(rowIndex: number, categoryId: number) {
    if (isMobileViewport) {
      setExpandedCategories((current) => ({
        ...current,
        [categoryId]: !current[categoryId]
      }));
      return;
    }

    setExpandedRows((current) => ({
      ...current,
      [rowIndex]: !current[rowIndex]
    }));
  }

  function isCategoryExpanded(rowIndex: number, categoryId: number) {
    if (isMobileViewport) return Boolean(expandedCategories[categoryId]);
    return Boolean(expandedRows[rowIndex]);
  }

  function closeSearch() {
    setIsSearchOpen(false);
    setQuery("");
  }

  function openSearch() {
    setIsTimelineOpen(false);
    setIsSearchOpen(true);
  }

  function closeTimeline() {
    setIsTimelineOpen(false);
  }

  function openTimeline() {
    setIsSearchOpen(false);
    setQuery("");
    setIsTimelineOpen(true);
  }

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
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewportMode = () => setIsMobileViewport(mediaQuery.matches);

    updateViewportMode();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateViewportMode);
      return () => mediaQuery.removeEventListener("change", updateViewportMode);
    }

    mediaQuery.addListener(updateViewportMode);
    return () => mediaQuery.removeListener(updateViewportMode);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsTimelineOpen(false);
        setIsSearchOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setQuery("");
        setIsTimelineOpen(false);
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
    if (!isTimelineOpen) return;

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
  }, [isTimelineOpen]);

  useEffect(() => {
    const hasOverlayOpen = isSearchOpen || isTimelineOpen;
    if (!hasOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchOpen, isTimelineOpen]);

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

  const isQueryEmpty = normalizedQuery.length === 0;
  const sortedTimelineEntries = useMemo(
    () =>
      [...timelineEntries].sort((a, b) => {
        const dateDiff = getTimelineDateTimestamp(b.tastedOn) - getTimelineDateTimestamp(a.tastedOn);
        if (dateDiff !== 0) return dateDiff;
        if (a.slot !== b.slot) return a.slot - b.slot;
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
          const rowIndex = Math.floor(categoryIndex / 3);
          const isRowExpanded = isCategoryExpanded(rowIndex, category.id);
          const isAllergenCategory = category.name === ALLERGEN_CATEGORY_NAME;
          const allergenSummary = isAllergenCategory ? buildAllergenSummary(category.foods) : null;
          const categoryPictogram = getCategoryPictogram(category.name);

          return (
            <article
              key={category.id}
              className={`category-card ${toneByCategory[category.name] || "tone-other"} rounded-3xl`}
            >
              <h3 className="category-title">
                <button
                  type="button"
                  className="category-pill category-toggle touch-manipulation min-h-[44px]"
                  aria-expanded={isRowExpanded}
                  title={isRowExpanded ? "Replier le tableau" : "Dérouler le tableau"}
                  onClick={() => toggleCategory(rowIndex, category.id)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">{categoryPictogram}</span>
                    <span>{category.name}</span>
                  </span>
                  <span className="category-toggle-icon" aria-hidden="true">
                    {isRowExpanded ? "▾" : "▴"}
                  </span>
                </button>
              </h3>

              {isAllergenCategory && allergenSummary ? (
                <section className="allergen-focus-summary" aria-label="Résumé allergènes">
                  <div className="allergen-focus-stats">
                    <p className="allergen-focus-stat">
                      <span>À tester</span>
                      <strong>{allergenSummary.toTestCount}</strong>
                    </p>
                    <p className="allergen-focus-stat">
                      <span>En cours</span>
                      <strong>{allergenSummary.inProgressCount}</strong>
                    </p>
                    <p className="allergen-focus-stat">
                      <span>Consolidés</span>
                      <strong>{allergenSummary.consolidatedCount}</strong>
                    </p>
                  </div>
                </section>
              ) : null}

              <ul className={`category-list ${isRowExpanded ? "expanded" : "collapsed"}`}>
                {category.foods.map((food) => (
                  <VegetableRow
                    key={food.id}
                    foodId={food.id}
                    name={food.name}
                    tastings={food.tastings}
                    tastingCount={food.tastingCount}
                    finalPreference={finalPreferenceOverridesByFoodId[food.id] ?? food.finalPreference}
                    note={food.note}
                    onCycleFinalPreference={cycleFinalPreference}
                    childFirstName={childFirstName}
                    isAllergen={isAllergenCategory}
                    allergenStage={isAllergenCategory ? getAllergenStage(food.tastingCount) : null}
                  />
                ))}
              </ul>
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
                      note={food.note}
                      onCycleFinalPreference={cycleFinalPreference}
                      childFirstName={childFirstName}
                      isAllergen={food.categoryName === ALLERGEN_CATEGORY_NAME}
                      allergenStage={
                        food.categoryName === ALLERGEN_CATEGORY_NAME
                          ? getAllergenStage(food.tastingCount)
                          : null
                      }
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
                            <article className="food-timeline-card">
                              <header className="food-timeline-card-header">
                                <p className="food-timeline-food-name">{entry.foodName}</p>
                                <span className={`food-timeline-slot-badge slot-${entry.slot}`}>
                                  <Image
                                    src={getTimelineTigerIcon(entry.preference)}
                                    alt=""
                                    aria-hidden="true"
                                    width={20}
                                    height={20}
                                    unoptimized
                                    className="food-timeline-slot-icon"
                                  />
                                  <span>Tigre {entry.slot}/3</span>
                                </span>
                              </header>

                              <p className="food-timeline-meta-row">
                                <span
                                  className={`food-timeline-category-pill ${toneByCategory[entry.categoryName] || "tone-other"}`}
                                >
                                  {entry.categoryName}
                                </span>
                                <span className="food-timeline-preference-text">{getPreferenceLabel(entry.preference)}</span>
                              </p>

                              {entry.note.trim() ? <p className="food-timeline-note">{entry.note}</p> : null}
                            </article>
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
    </section>
  );
}
