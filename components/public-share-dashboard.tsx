"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { buildCategoryKpi, buildTimelineEntries } from "@/lib/dashboard-read-model";
import { getCategoryUi } from "@/lib/category-ui";
import type { DashboardCategory, FinalPreferenceValue } from "@/lib/types";
import { getFinalPreferenceImageSrc, getFinalPreferenceLabel, getTimelineTigerIcon } from "@/lib/ui-utils";
import { PublicShareFoodDetailModal } from "@/components/public-share-food-detail-modal";
import { PublicShareTimelinePanel } from "@/components/public-share-timeline-panel";

type PublicShareDashboardProps = {
  categories: DashboardCategory[];
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
};

type FoodIndexEntry = {
  food: DashboardCategory["foods"][number];
  categoryName: string;
};

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

export function PublicShareDashboard({
  categories,
  toneByCategory,
  childFirstName = null
}: PublicShareDashboardProps) {
  const [openByCategoryId, setOpenByCategoryId] = useState<Record<number, boolean>>({});
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [detailFoodId, setDetailFoodId] = useState<number | null>(null);
  const timelineTriggerRef = useRef<HTMLButtonElement>(null);

  const timelineEntries = useMemo(() => buildTimelineEntries(categories), [categories]);

  const foodIndexById = useMemo(() => {
    const index = new Map<number, FoodIndexEntry>();

    for (const category of categories) {
      for (const food of category.foods) {
        index.set(food.id, { food, categoryName: category.name });
      }
    }

    return index;
  }, [categories]);

  const finalPreferenceByFoodId = useMemo(() => {
    const preferenceMap = new Map<number, FinalPreferenceValue>();

    for (const category of categories) {
      for (const food of category.foods) {
        preferenceMap.set(food.id, food.finalPreference);
      }
    }

    return preferenceMap;
  }, [categories]);

  const detailEntry = detailFoodId !== null ? foodIndexById.get(detailFoodId) ?? null : null;
  const detailFood = detailEntry?.food ?? null;
  const detailCategoryName = detailEntry?.categoryName ?? "";
  const detailToneClass = toneByCategory[detailCategoryName] || "tone-other";

  function toggleCategory(categoryId: number) {
    setOpenByCategoryId((current) => ({
      ...current,
      [categoryId]: !current[categoryId]
    }));
  }

  function openFoodDetail(foodId: number) {
    setDetailFoodId(foodId);
  }

  function closeFoodDetail() {
    setDetailFoodId(null);
  }

  function closeTimeline() {
    setIsTimelineOpen(false);
    timelineTriggerRef.current?.focus();
  }

  return (
    <section className="public-share-dashboard">
      <div className="public-share-dashboard-toolbar">
        <button
          ref={timelineTriggerRef}
          type="button"
          className="timeline-trigger-btn"
          onClick={() => setIsTimelineOpen(true)}
        >
          <span>Carnets de bords</span>
        </button>
      </div>

      <section className="categories-grid public-share-categories-grid">
        {categories.map((category) => {
          const isOpen = Boolean(openByCategoryId[category.id]);
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
                    <span aria-hidden="true">{getCategoryPictogram(category.name)}</span>
                    <span>{category.name}</span>
                  </span>
                  <span className="category-toggle-icon" aria-hidden="true">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </button>
              </h3>

              {isOpen ? (
                <ul className="category-list open public-share-category-list">
                  {category.foods.map((food) => {
                    const tastingsBySlot = new Map(food.tastings.map((tasting) => [tasting.slot, tasting]));

                    return (
                      <li key={food.id}>
                        <button
                          type="button"
                          className="public-share-food-row"
                          onClick={() => openFoodDetail(food.id)}
                          aria-label={`Voir le détail de ${food.name}`}
                        >
                          <span className="public-share-food-row-main">
                            <span className="public-share-food-name">{food.name}</span>
                            <span className="public-share-food-stats">{food.tastingCount}/3 essais</span>
                          </span>

                          <span className="public-share-food-row-icons" aria-hidden="true">
                            {[1, 2, 3].map((slot) => {
                              const tasting = tastingsBySlot.get(slot as 1 | 2 | 3);
                              return (
                                <span key={`${food.id}-${slot}`} className="public-share-food-slot">
                                  {tasting ? (
                                    <Image
                                      src={getTimelineTigerIcon(tasting.liked)}
                                      alt=""
                                      width={24}
                                      height={24}
                                    />
                                  ) : (
                                    <span className="public-share-food-slot-empty" />
                                  )}
                                </span>
                              );
                            })}

                            <span className="public-share-food-final-preference">
                              <Image
                                src={getFinalPreferenceImageSrc(food.finalPreference)}
                                alt=""
                                width={30}
                                height={30}
                              />
                              <span className="sr-only">
                                Préférence finale: {getFinalPreferenceLabel(food.finalPreference)}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
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

      <PublicShareTimelinePanel
        isOpen={isTimelineOpen}
        isDetailOpen={detailFoodId !== null}
        onClose={closeTimeline}
        timelineEntries={timelineEntries}
        finalPreferenceByFoodId={finalPreferenceByFoodId}
        onOpenFoodDetail={openFoodDetail}
        toneByCategory={toneByCategory}
        childFirstName={childFirstName}
      />

      <PublicShareFoodDetailModal
        isOpen={detailFood !== null}
        onClose={closeFoodDetail}
        childFirstName={childFirstName}
        foodName={detailFood?.name ?? ""}
        categoryName={detailCategoryName}
        categoryToneClass={detailToneClass}
        tastings={detailFood?.tastings ?? []}
        tastingCount={detailFood?.tastingCount ?? 0}
        finalPreference={detailFood?.finalPreference ?? 0}
        note={detailFood?.note ?? ""}
      />
    </section>
  );
}
