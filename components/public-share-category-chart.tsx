"use client";

import { useMemo, useRef, useState } from "react";
import { PublicShareFoodListDialog } from "@/components/public-share-food-list-dialog";
import { getCategoryUi } from "@/lib/category-ui";
import { formatPublicShareFoodCountLabel, PUBLIC_SHARE_PREFERENCE_UI } from "@/lib/public-share-preferences";
import type { PublicShareCategoryDiscovery, PublicShareCategoryFoodList } from "@/lib/types";

type PublicShareCategoryChartProps = {
  categoryDiscoveryCounts: PublicShareCategoryDiscovery[];
  categoryFoodLists: PublicShareCategoryFoodList[];
  toneByCategory: Record<string, string>;
};

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

export function PublicShareCategoryChart({
  categoryDiscoveryCounts,
  categoryFoodLists,
  toneByCategory
}: PublicShareCategoryChartProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const categoryFoodListById = useMemo(
    () => new Map(categoryFoodLists.map((category) => [category.categoryId, category.foods])),
    [categoryFoodLists]
  );

  const activeCategory = activeCategoryId !== null
    ? categoryDiscoveryCounts.find((category) => category.categoryId === activeCategoryId) ?? null
    : null;
  const activeFoods = activeCategoryId !== null ? categoryFoodListById.get(activeCategoryId) ?? [] : [];

  function openCategoryDialog(categoryId: number, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setActiveCategoryId(categoryId);
  }

  function closeCategoryDialog() {
    setActiveCategoryId(null);
    const trigger = triggerRef.current;
    window.requestAnimationFrame(() => {
      trigger?.focus();
    });
  }

  return (
    <section
      className="public-share-panel public-share-panel-chart public-share-panel-chart-wide public-share-category-panel"
      aria-labelledby="public-share-categories-title"
    >
      <header className="public-share-section-head">
        <div>
          <p className="public-share-section-kicker">Répartition</p>
          <h2 id="public-share-categories-title">Découvertes par catégorie</h2>
        </div>
      </header>

      <ol className="public-share-category-bars">
        {categoryDiscoveryCounts.map((category) => (
          <li
            key={category.categoryId}
            className={`public-share-category-bar ${toneByCategory[category.categoryName] || "tone-other"} ${
              activeCategoryId === category.categoryId ? "public-share-category-bar--active" : ""
            }`}
          >
            <button
              type="button"
              className="public-share-category-bar-button"
              aria-haspopup="dialog"
              aria-expanded={activeCategoryId === category.categoryId}
              onClick={(event) => openCategoryDialog(category.categoryId, event.currentTarget)}
            >
              <div className="public-share-category-bar-head">
                <p>
                  <span aria-hidden="true">{getCategoryPictogram(category.categoryName)}</span>
                  <span>{category.categoryName}</span>
                </p>
                <strong>
                  {category.discoveredCount}/{category.totalCount}
                </strong>
              </div>

              <div
                className="public-share-category-meter"
                role="img"
                aria-label={`${category.categoryName}: ${category.discoveredCount} aliments découverts sur ${category.totalCount}.`}
              >
                <span style={{ width: `${clampPercentage(category.discoveredPercent)}%` }} aria-hidden="true" />
              </div>
            </button>
          </li>
        ))}
      </ol>

      <PublicShareFoodListDialog
        isOpen={activeCategory !== null}
        onClose={closeCategoryDialog}
        title={activeCategory?.categoryName ?? ""}
        description={`${formatPublicShareFoodCountLabel(activeFoods.length)} testé${activeFoods.length === 1 ? "" : "s"} dans cette catégorie.`}
        kicker="Aliments testés"
        closeLabel={activeCategory ? `Fermer la catégorie ${activeCategory.categoryName.toLowerCase()}` : "Fermer la catégorie"}
        listAriaLabel={activeCategory ? `Aliments testés de la catégorie ${activeCategory.categoryName}` : "Aliments testés"}
        emptyMessage="Aucun aliment testé dans cette catégorie pour le moment."
        items={activeFoods.map((food) => ({
          key: `${food.foodId}`,
          label: food.foodName,
          preferenceKey: food.preferenceKey
        }))}
        dialogClassName={PUBLIC_SHARE_PREFERENCE_UI.neutral.dialogClassName}
      />
    </section>
  );
}
