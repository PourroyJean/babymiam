"use client";

import { useRef, useState } from "react";
import { PublicShareFoodListDialog } from "@/components/public-share-food-list-dialog";
import {
  formatPublicShareFoodCountLabel,
  PUBLIC_SHARE_PREFERENCE_KEYS,
  PUBLIC_SHARE_PREFERENCE_UI
} from "@/lib/public-share-preferences";
import type { PublicSharePreferenceCounts, PublicSharePreferenceFoodLists, PublicSharePreferenceKey } from "@/lib/types";

type PublicSharePreferenceChartProps = {
  childLabel: string;
  preferenceCounts: PublicSharePreferenceCounts;
  foodLists: PublicSharePreferenceFoodLists;
};

function buildDonutSegments(preferenceCounts: PublicSharePreferenceCounts) {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const data = PUBLIC_SHARE_PREFERENCE_KEYS.map((key) => ({
    key,
    ...PUBLIC_SHARE_PREFERENCE_UI[key],
    value: preferenceCounts[key]
  }));
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  let progress = 0;

  const segments = data.map((entry) => {
    const segmentLength = total > 0 ? (entry.value / total) * circumference : 0;
    const segment = {
      ...entry,
      circumference,
      radius,
      strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
      strokeDashoffset: -progress
    };
    progress += segmentLength;
    return segment;
  });

  return { total, segments };
}

export function PublicSharePreferenceChart({
  childLabel,
  preferenceCounts,
  foodLists
}: PublicSharePreferenceChartProps) {
  const { total, segments } = buildDonutSegments(preferenceCounts);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [activePreference, setActivePreference] = useState<PublicSharePreferenceKey | null>(null);

  function openPreferenceDialog(preference: PublicSharePreferenceKey, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setActivePreference(preference);
  }

  function closePreferenceDialog() {
    setActivePreference(null);
    const trigger = triggerRef.current;
    window.requestAnimationFrame(() => {
      trigger?.focus();
    });
  }

  const activeConfig = activePreference ? PUBLIC_SHARE_PREFERENCE_UI[activePreference] : null;
  const activeFoodNames = activePreference ? foodLists[activePreference] : [];

  return (
    <>
      <section className="public-share-panel public-share-panel-chart" aria-labelledby="public-share-reactions-title">
        <header className="public-share-section-head">
          <div>
            <p className="public-share-section-kicker">Préférences finales</p>
            <h2 id="public-share-reactions-title">Comment {childLabel} réagit</h2>
          </div>
        </header>

        <div className="public-share-donut-layout">
          <div className="public-share-donut-visual">
            <svg
              className="public-share-donut"
              viewBox="0 0 220 220"
              role="img"
              aria-label={
                total > 0
                  ? `${total} aliments validés: ${preferenceCounts.liked} aimés, ${preferenceCounts.neutral} neutres, ${preferenceCounts.disliked} pas aimés.`
                  : "Aucun aliment validé pour le moment."
              }
            >
              <circle cx="110" cy="110" r="78" className="public-share-donut-track" />
              {segments.map((segment) =>
                segment.value > 0 ? (
                  <circle
                    key={segment.key}
                    cx="110"
                    cy="110"
                    r={segment.radius}
                    className="public-share-donut-segment"
                    style={{
                      stroke: segment.color,
                      strokeDasharray: segment.strokeDasharray,
                      strokeDashoffset: `${segment.strokeDashoffset}`
                    }}
                  />
                ) : null
              )}
            </svg>

            <div className="public-share-donut-center">
              <strong>{total}</strong>
              <span>validés</span>
            </div>
          </div>

          <ul className="public-share-donut-legend">
            {segments.map((segment) => {
              const share = total > 0 ? Math.round((segment.value / total) * 100) : 0;

              return (
                <li key={segment.key}>
                  <button
                    type="button"
                    className={`public-share-donut-legend-button public-share-donut-legend-button--${segment.key}`}
                    aria-haspopup="dialog"
                    aria-expanded={activePreference === segment.key}
                    onClick={(event) => openPreferenceDialog(segment.key, event.currentTarget)}
                  >
                    <span className="public-share-donut-legend-label">
                      <span className="public-share-donut-legend-dot" style={{ backgroundColor: segment.color }} />
                      {segment.label}
                    </span>
                    <strong>{segment.value}</strong>
                    <span>{share}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {total === 0 ? <p className="public-share-chart-empty">Aucun aliment validé pour le moment.</p> : null}
      </section>

      <PublicShareFoodListDialog
        isOpen={activePreference !== null && activeConfig !== null}
        onClose={closePreferenceDialog}
        title={activeConfig?.label ?? ""}
        description={`${formatPublicShareFoodCountLabel(activeFoodNames.length)} dans cette catégorie.`}
        kicker="Préférences finales"
        closeLabel={activeConfig ? `Fermer la liste ${activeConfig.label.toLowerCase()}` : "Fermer la liste"}
        listAriaLabel={activeConfig ? `Aliments ${activeConfig.label.toLowerCase()}` : "Aliments"}
        emptyMessage={activeConfig?.emptyMessage ?? "Aucun aliment dans cette catégorie pour le moment."}
        items={activeFoodNames.map((foodName, index) => ({
          key: `${activePreference ?? "preference"}-${foodName}-${index}`,
          label: foodName,
          preferenceKey: activePreference ?? undefined
        }))}
        dialogClassName={activeConfig?.dialogClassName}
      />
    </>
  );
}
