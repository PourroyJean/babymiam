"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FoodRow } from "@/components/food-row";
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

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const FRENCH_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
const RECENT_FOODS_LIMIT = 15;

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

export function CategoriesGrid({ categories, toneByCategory }: CategoriesGridProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpenRef = useRef(false);

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

      <section className="categories-grid">
        {categories.map((category, categoryIndex) => {
          const rowIndex = Math.floor(categoryIndex / 3);
          const isRowExpanded = isCategoryExpanded(rowIndex, category.id);

          return (
            <article
              key={category.id}
              className={`category-card ${toneByCategory[category.name] || "tone-other"}`}
            >
              <h3 className="category-title">
                <button
                  type="button"
                  className="category-pill category-toggle"
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

              <ul className={`category-list ${isRowExpanded ? "expanded" : "collapsed"}`}>
                {category.foods.map((food) => (
                  <FoodRow
                    key={food.id}
                    foodId={food.id}
                    name={food.name}
                    exposureCount={food.exposureCount}
                    preference={food.preference}
                    firstTastedOn={food.firstTastedOn}
                    note={food.note}
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
                    <FoodRow
                      key={`search-${food.id}`}
                      foodId={food.id}
                      name={food.name}
                      exposureCount={food.exposureCount}
                      preference={food.preference}
                      firstTastedOn={food.firstTastedOn}
                      note={food.note}
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
