"use client";

import { useState } from "react";
import { FoodRow } from "@/components/food-row";
import type { DashboardCategory } from "@/lib/types";

type CategoriesGridProps = {
  categories: DashboardCategory[];
  toneByCategory: Record<string, string>;
};

export function CategoriesGrid({ categories, toneByCategory }: CategoriesGridProps) {
  const [areSectionsExpanded, setAreSectionsExpanded] = useState(false);

  return (
    <section className="categories-grid">
      {categories.map((category) => (
        <article
          key={category.id}
          className={`category-card ${toneByCategory[category.name] || "tone-other"}`}
        >
          <h3 className="category-title">
            <button
              type="button"
              className="category-pill category-toggle"
              aria-expanded={areSectionsExpanded}
              title={areSectionsExpanded ? "Replier toutes les sections" : "Dérouler toutes les sections"}
              onClick={() => setAreSectionsExpanded((current) => !current)}
            >
              <span>{category.name}</span>
              <span className="category-toggle-icon" aria-hidden="true">
                {areSectionsExpanded ? "▴" : "▾"}
              </span>
            </button>
          </h3>

          <ul className={`category-list ${areSectionsExpanded ? "expanded" : "collapsed"}`}>
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
      ))}
    </section>
  );
}
