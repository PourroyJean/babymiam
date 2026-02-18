"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { VegetableRow } from "@/components/vegetable-row";
import type { DashboardFood, FinalPreferenceValue } from "@/lib/types";
import {
  FRENCH_COLLATOR,
  getSearchRank,
  getUpdatedTimestamp,
  normalizeSearchValue
} from "@/lib/ui-utils";

type SearchFood = DashboardFood & {
  categoryId: number;
  categoryName: string;
  normalizedName: string;
};

type SearchPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  searchableFoods: SearchFood[];
  finalPreferenceOverridesByFoodId: Record<number, FinalPreferenceValue>;
  cycleFinalPreference: (foodId: number) => void;
  openFoodSummary: (foodId: number, triggerEl: HTMLElement) => void;
  childFirstName?: string | null;
};

const RECENT_FOODS_LIMIT = 15;

export function SearchPanel({
  isOpen,
  onClose,
  searchableFoods,
  finalPreferenceOverridesByFoodId,
  cycleFinalPreference,
  openFoodSummary,
  childFirstName
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const animationFrame = window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(animationFrame);
    }

    setQuery("");
  }, [isOpen]);

  const normalizedQuery = useMemo(() => normalizeSearchValue(query), [query]);
  const isQueryEmpty = normalizedQuery.length === 0;

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
      .flatMap((food) => {
        const rank = getSearchRank(food.normalizedName, normalizedQuery);
        if (rank === null) return [];
        return [{ food, rank }];
      })
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return FRENCH_COLLATOR.compare(a.food.name, b.food.name);
      })
      .map((entry) => entry.food);
  }, [normalizedQuery, recentFoods, searchableFoods]);

  if (!isOpen) return null;

  return (
    <div className="food-search-overlay" onClick={onClose} role="presentation">
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
            onClick={onClose}
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
  );
}
