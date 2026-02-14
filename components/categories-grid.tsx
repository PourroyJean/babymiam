"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setFinalPreferenceAction } from "@/app/actions";
import { VegetableRow } from "@/components/vegetable-row";
import type { DashboardCategory, DashboardFood } from "@/lib/types";

type CategoriesGridProps = {
  categories: DashboardCategory[];
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
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
const RECENT_FOODS_LIMIT = 15;
const FINAL_PREFERENCE_DEBOUNCE_MS = 2000;
const ALLERGEN_CATEGORY_NAME = "Allergènes majeurs";
const CATEGORY_PICTOGRAM_BY_NAME: Record<string, string> = {
  "Légumes": "🥕",
  "Fruits": "🍓",
  "Féculents": "🍞",
  "Protéines": "🍖",
  "Légumineuses": "🫘",
  "Produits laitiers": "🥛",
  "Allergènes majeurs": "✨",
  "Épices": "🌶️",
  "Oléagineux et huiles": "🫒",
  "Herbes et aromates": "🌿",
  "Sucreries": "🍬",
  "Condiments": "🧂",
  "Autres": "🍽️"
};
const DEFAULT_CATEGORY_PICTOGRAM = "✨";

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
  return CATEGORY_PICTOGRAM_BY_NAME[categoryName] || DEFAULT_CATEGORY_PICTOGRAM;
}

export function CategoriesGrid({ categories, toneByCategory, childFirstName = null }: CategoriesGridProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showTestedOnly, setShowTestedOnly] = useState(false);
  const [finalPreferenceOverridesByFoodId, setFinalPreferenceOverridesByFoodId] = useState<
    Record<number, FinalPreferenceValue>
  >({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpenRef = useRef(false);
  const finalPreferenceOverridesRef = useRef<Record<number, FinalPreferenceValue>>({});
  const serverFinalPreferenceByFoodIdRef = useRef<Map<number, FinalPreferenceValue>>(new Map());
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

  return (
    <section className="categories-section">
      <div className="categories-toolbar">
        <section className="toolbox-card">
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
    </section>
  );
}
