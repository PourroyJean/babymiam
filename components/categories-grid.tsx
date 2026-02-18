"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setFinalPreferenceAction } from "@/app/actions";
import { FoodSummaryModal } from "@/components/food-summary-modal";
import { QuickAddPanel } from "@/components/quick-add-panel";
import { SearchPanel } from "@/components/search-panel";
import { TimelinePanel } from "@/components/timeline-panel";
import { VegetableRow } from "@/components/vegetable-row";
import { getCategoryUi } from "@/lib/category-ui";
import type { DashboardCategory, DashboardFood, FinalPreferenceValue, FoodTimelineEntry } from "@/lib/types";
import { getNextFinalPreference, normalizeSearchValue } from "@/lib/ui-utils";

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

type CategoryKpi = {
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  discoveredCount: number;
  discoveredPercent: number;
  donePercent: number;
};

const FINAL_PREFERENCE_DEBOUNCE_MS = 2000;

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
  const [showTestedOnly, setShowTestedOnly] = useState(false);
  const [finalPreferenceOverridesByFoodId, setFinalPreferenceOverridesByFoodId] = useState<
    Record<number, FinalPreferenceValue>
  >({});
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const timelineTriggerRef = useRef<HTMLButtonElement>(null);
  const quickAddTriggerRef = useRef<HTMLButtonElement>(null);
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
    setIsQuickAddOpen(false);
    setIsTimelineOpen(true);
  }

  function closeQuickAdd() {
    setIsQuickAddOpen(false);
  }

  function openQuickAdd() {
    setIsSearchOpen(false);
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



  const finalPreferenceByFoodId = useMemo(() => {
    const preferenceMap = new Map<number, -1 | 0 | 1>();

    for (const category of categories) {
      for (const food of category.foods) {
        preferenceMap.set(food.id, finalPreferenceOverridesByFoodId[food.id] ?? food.finalPreference);
      }
    }

    return preferenceMap;
  }, [categories, finalPreferenceOverridesByFoodId]);



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

        {visibleCategories.map((category) => {
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

      <SearchPanel
        isOpen={isSearchOpen}
        onClose={closeSearch}
        searchableFoods={searchableFoods}
        finalPreferenceOverridesByFoodId={finalPreferenceOverridesByFoodId}
        cycleFinalPreference={cycleFinalPreference}
        openFoodSummary={openFoodSummary}
        childFirstName={childFirstName}
      />

      <TimelinePanel
        isOpen={isTimelineOpen}
        isSummaryOpen={isSummaryOpen}
        onClose={closeTimeline}
        timelineEntries={timelineEntries}
        finalPreferenceByFoodId={finalPreferenceByFoodId}
        openFoodSummary={openFoodSummary}
        toneByCategory={toneByCategory}
        childFirstName={childFirstName}
      />

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
