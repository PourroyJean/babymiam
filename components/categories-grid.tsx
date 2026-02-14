"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setPreferenceAction } from "@/app/actions";
import { VegetableRow } from "@/components/vegetable-row";
import type { DashboardCategory, DashboardFood } from "@/lib/types";

type CategoriesGridProps = {
  categories: DashboardCategory[];
  toneByCategory: Record<string, string>;
};

type SearchFood = DashboardFood & {
  categoryId: number;
  categoryName: string;
  normalizedName: string;
};

type PreferenceValue = -1 | 0 | 1;
type AllergenStage = 0 | 1 | 2 | 3;
type AllergenSummary = {
  toTestCount: number;
  inProgressCount: number;
  consolidatedCount: number;
};

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const FRENCH_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
const RECENT_FOODS_LIMIT = 15;
const PREFERENCE_DEBOUNCE_MS = 2000;
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

function getAllergenStage(exposureCount: number): AllergenStage {
  const normalizedValue = Math.max(0, Math.trunc(exposureCount));
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
    const stage = getAllergenStage(food.exposureCount);

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

function getNextPreference(current: PreferenceValue): PreferenceValue {
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

export function CategoriesGrid({ categories, toneByCategory }: CategoriesGridProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [preferenceOverridesByFoodId, setPreferenceOverridesByFoodId] = useState<Record<number, PreferenceValue>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpenRef = useRef(false);
  const preferenceOverridesRef = useRef<Record<number, PreferenceValue>>({});
  const serverPreferenceByFoodIdRef = useRef<Map<number, PreferenceValue>>(new Map());
  const debounceTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPreferenceByFoodIdRef = useRef<Map<number, PreferenceValue>>(new Map());
  const inFlightPreferenceByFoodIdRef = useRef<Map<number, PreferenceValue>>(new Map());

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

  const serverPreferenceByFoodId = useMemo(() => {
    const preferenceMap = new Map<number, PreferenceValue>();

    for (const category of categories) {
      for (const food of category.foods) {
        preferenceMap.set(food.id, food.preference);
      }
    }

    return preferenceMap;
  }, [categories]);

  useEffect(() => {
    serverPreferenceByFoodIdRef.current = serverPreferenceByFoodId;
  }, [serverPreferenceByFoodId]);

  useEffect(() => {
    preferenceOverridesRef.current = preferenceOverridesByFoodId;
  }, [preferenceOverridesByFoodId]);

  const removePreferenceOverride = useCallback((foodId: number) => {
    setPreferenceOverridesByFoodId((current) => {
      if (!(foodId in current)) return current;

      const next = { ...current };
      delete next[foodId];
      preferenceOverridesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    setPreferenceOverridesByFoodId((current) => {
      let hasChanges = false;
      const next = { ...current };

      for (const [foodIdRaw, value] of Object.entries(current)) {
        const foodId = Number(foodIdRaw);

        if (pendingPreferenceByFoodIdRef.current.has(foodId)) continue;
        if (inFlightPreferenceByFoodIdRef.current.get(foodId) === value) continue;

        const serverValue = serverPreferenceByFoodId.get(foodId);
        if (serverValue === undefined || serverValue === value) {
          delete next[foodId];
          inFlightPreferenceByFoodIdRef.current.delete(foodId);
          hasChanges = true;
          continue;
        }

        // No pending/in-flight write for this value: server is now source of truth.
        if (serverValue !== value) {
          delete next[foodId];
          inFlightPreferenceByFoodIdRef.current.delete(foodId);
          hasChanges = true;
        }
      }

      if (!hasChanges) return current;
      preferenceOverridesRef.current = next;
      return next;
    });
  }, [serverPreferenceByFoodId]);

  const persistPreference = useCallback(async (foodId: number, preference: PreferenceValue) => {
    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("value", String(preference));
    await setPreferenceAction(formData);
  }, []);

  const flushPendingPreference = useCallback(
    (foodId: number) => {
      const existingTimer = debounceTimersRef.current.get(foodId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current.delete(foodId);
      }

      const pendingValue = pendingPreferenceByFoodIdRef.current.get(foodId);
      if (pendingValue === undefined) return;

      pendingPreferenceByFoodIdRef.current.delete(foodId);
      inFlightPreferenceByFoodIdRef.current.set(foodId, pendingValue);

      void persistPreference(foodId, pendingValue)
        .catch((error) => {
          const redirectUrl = getRedirectUrlFromError(error);
          if (redirectUrl) {
            window.location.assign(redirectUrl);
            return;
          }

          removePreferenceOverride(foodId);
        })
        .finally(() => {
          inFlightPreferenceByFoodIdRef.current.delete(foodId);
        });
    },
    [persistPreference, removePreferenceOverride]
  );

  const flushAllPendingPreferences = useCallback(() => {
    const pendingFoodIds = Array.from(pendingPreferenceByFoodIdRef.current.keys());
    for (const foodId of pendingFoodIds) {
      flushPendingPreference(foodId);
    }
  }, [flushPendingPreference]);

  const cyclePreference = useCallback(
    (foodId: number) => {
      const serverPreference = serverPreferenceByFoodIdRef.current.get(foodId) ?? 0;
      const currentPreference = preferenceOverridesRef.current[foodId] ?? serverPreference;
      const nextPreference = getNextPreference(currentPreference);

      const nextOverrides = {
        ...preferenceOverridesRef.current,
        [foodId]: nextPreference
      };

      preferenceOverridesRef.current = nextOverrides;
      setPreferenceOverridesByFoodId(nextOverrides);
      pendingPreferenceByFoodIdRef.current.set(foodId, nextPreference);

      const existingTimer = debounceTimersRef.current.get(foodId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timerId = setTimeout(() => {
        flushPendingPreference(foodId);
      }, PREFERENCE_DEBOUNCE_MS);

      debounceTimersRef.current.set(foodId, timerId);
    },
    [flushPendingPreference]
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
        setIsSearchOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setQuery("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;

    function onPageHide() {
      flushAllPendingPreferences();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushAllPendingPreferences();
      }
    }

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushAllPendingPreferences();

      for (const timerId of debounceTimers.values()) {
        clearTimeout(timerId);
      }
      debounceTimers.clear();
    };
  }, [flushAllPendingPreferences]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isSearchOpen]);

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

  const searchableFoods = useMemo<SearchFood[]>(
    () =>
      categories.flatMap((category) =>
        category.foods.map((food) => ({
          ...food,
          categoryId: category.id,
          categoryName: category.name,
          normalizedName: normalizeSearchValue(food.name)
        }))
      ),
    [categories]
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

  return (
    <section className="categories-section">
      <div className="categories-toolbar">
        <div className="categories-toolbar-actions">
          <button
            ref={searchTriggerRef}
            type="button"
            className="search-trigger-btn"
            onClick={() => setIsSearchOpen(true)}
          >
            <span>Rechercher un aliment</span>
            <span className="search-trigger-shortcut" aria-hidden="true">
              ⌘/Ctrl + K
            </span>
          </button>
        </div>
      </div>

      <section className="categories-grid">
        {categories.map((category, categoryIndex) => {
          const rowIndex = Math.floor(categoryIndex / 3);
          const isRowExpanded = isCategoryExpanded(rowIndex, category.id);
          const isAllergenCategory = category.name === ALLERGEN_CATEGORY_NAME;
          const allergenSummary = isAllergenCategory ? buildAllergenSummary(category.foods) : null;

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
                  <span>{category.name}</span>
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
                    exposureCount={food.exposureCount}
                    preference={preferenceOverridesByFoodId[food.id] ?? food.preference}
                    firstTastedOn={food.firstTastedOn}
                    note={food.note}
                    onCyclePreference={cyclePreference}
                    isAllergen={isAllergenCategory}
                    allergenStage={isAllergenCategory ? getAllergenStage(food.exposureCount) : null}
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
                      exposureCount={food.exposureCount}
                      preference={preferenceOverridesByFoodId[food.id] ?? food.preference}
                      firstTastedOn={food.firstTastedOn}
                      note={food.note}
                      onCyclePreference={cyclePreference}
                      isAllergen={food.categoryName === ALLERGEN_CATEGORY_NAME}
                      allergenStage={
                        food.categoryName === ALLERGEN_CATEGORY_NAME
                          ? getAllergenStage(food.exposureCount)
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
    </section>
  );
}
