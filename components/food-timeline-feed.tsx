"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { FinalPreferenceLookup, FoodTimelineEntry } from "@/lib/types";
import {
  DEFAULT_REACTION_TYPE,
  getReactionOption,
  getTextureOption
} from "@/lib/tasting-metadata";
import {
  FRENCH_COLLATOR,
  formatTimelineDayLabel,
  getFinalPreferenceImageSrc,
  getFinalPreferenceLabel,
  getFinalTimelineToneClass,
  getTimelineDateTimestamp,
  getTimelineTigerIcon
} from "@/lib/ui-utils";
import { getCategoryUi } from "@/lib/category-ui";

type FoodTimelineFeedProps = {
  timelineEntries: FoodTimelineEntry[];
  finalPreferenceByFoodId: FinalPreferenceLookup;
  toneByCategory: Record<string, string>;
  emptyMessage: string;
  onFoodClick?: (foodId: number, triggerEl: HTMLElement) => void;
  buildFoodActionLabel?: (entry: FoodTimelineEntry) => string;
  foodActionTitle?: string;
};

function getFinalPreferenceForFood(
  lookup: FinalPreferenceLookup,
  foodId: number
) {
  if (lookup instanceof Map) {
    return lookup.get(foodId) ?? 0;
  }

  return lookup[foodId] ?? 0;
}

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

export function FoodTimelineFeed({
  timelineEntries,
  finalPreferenceByFoodId,
  toneByCategory,
  emptyMessage,
  onFoodClick,
  buildFoodActionLabel = (entry) => `Ouvrir le résumé de ${entry.foodName}`,
  foodActionTitle = "Résumé"
}: FoodTimelineFeedProps) {
  const sortedTimelineEntries = useMemo(
    () =>
      [...timelineEntries].sort((a, b) => {
        const dateDiff = getTimelineDateTimestamp(b.tastedOn) - getTimelineDateTimestamp(a.tastedOn);
        if (dateDiff !== 0) return dateDiff;
        if (a.slot !== b.slot) return b.slot - a.slot;
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

  if (timelineGroups.length === 0) {
    return <p className="food-search-empty">{emptyMessage}</p>;
  }

  return (
    <ol className="food-timeline-day-list">
      {timelineGroups.map((group) => (
        <li key={group.day} className="food-timeline-day-item">
          <h3 className="food-timeline-day-title">{group.label}</h3>
          <ol className="food-timeline-entry-list">
            {group.entries.map((entry) => {
              const entryFinalPreference = getFinalPreferenceForFood(finalPreferenceByFoodId, entry.foodId);
              const textureOption = getTextureOption(entry.textureLevel);
              const reactionOption = getReactionOption(entry.reactionType ?? DEFAULT_REACTION_TYPE);
              const textureLabel = `Texture: ${textureOption.shortName}. ${textureOption.description}`;
              const reactionLabel = reactionOption
                ? `Réaction observée: ${reactionOption.label}. ${reactionOption.description}`
                : "Réaction observée: Aucun symptôme";

              return (
                <li key={`${entry.foodId}-${entry.slot}-${entry.tastedOn}`} className="food-timeline-entry">
                  <article
                    className={`food-timeline-card ${
                      entry.slot === 3 ? `food-timeline-card--final ${getFinalTimelineToneClass(entryFinalPreference)}` : ""
                    }`}
                  >
                    <header className="food-timeline-card-header food-timeline-card-header--line">
                      <div className="food-timeline-one-liner food-timeline-one-liner--compact">
                        <span
                          className={`food-timeline-category-pill food-timeline-category-inline food-timeline-category-emoji-pill food-timeline-cell--category ${toneByCategory[entry.categoryName] || "tone-other"}`}
                          title={entry.categoryName}
                          aria-label={entry.categoryName}
                          role="img"
                        >
                          {getCategoryPictogram(entry.categoryName)}
                        </span>

                        {onFoodClick ? (
                          <button
                            type="button"
                            className="food-timeline-food-name food-timeline-food-name-inline food-timeline-cell--name touch-manipulation appearance-none [-webkit-appearance:none] border-0 bg-transparent p-0 text-left underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.99]"
                            onClick={(event) => onFoodClick(entry.foodId, event.currentTarget)}
                            aria-label={buildFoodActionLabel(entry)}
                            title={foodActionTitle}
                          >
                            {entry.foodName}
                          </button>
                        ) : (
                          <span className="food-timeline-food-name food-timeline-food-name-inline food-timeline-cell--name">
                            {entry.foodName}
                          </span>
                        )}

                        <span className={`food-timeline-slot-badge food-timeline-cell--slot slot-${entry.slot}`}>
                          <Image
                            src={getTimelineTigerIcon(entry.liked)}
                            alt=""
                            aria-hidden="true"
                            width={20}
                            height={20}
                            className="food-timeline-slot-icon"
                          />
                          <span>{entry.slot}/3</span>
                        </span>
                        <span
                          className="food-timeline-meta-chip food-timeline-meta-chip--texture food-timeline-cell--texture"
                          role="img"
                          aria-label={textureLabel}
                          title={textureLabel}
                          data-tooltip={textureLabel}
                        >
                          <Image
                            src={textureOption.iconSrc}
                            alt=""
                            aria-hidden="true"
                            width={22}
                            height={22}
                            className="food-timeline-meta-chip-icon"
                          />
                        </span>

                        <span
                          className="food-timeline-meta-chip food-timeline-meta-chip--reaction food-timeline-cell--reaction"
                          role="img"
                          aria-label={reactionLabel}
                          title={reactionLabel}
                          data-tooltip={reactionLabel}
                        >
                          <span className="food-timeline-meta-chip-emoji" aria-hidden="true">
                            {reactionOption?.emoji ?? "✅"}
                          </span>
                        </span>

                        {entry.slot === 3 ? (
                          <span
                            className="food-timeline-result-inline food-timeline-cell--result"
                            role="img"
                            aria-label={`Résultat final : ${getFinalPreferenceLabel(entryFinalPreference)}`}
                          >
                            <Image
                              src={getFinalPreferenceImageSrc(entryFinalPreference)}
                              alt=""
                              aria-hidden="true"
                              width={31}
                              height={31}
                              className="food-timeline-result-inline-icon"
                            />
                          </span>
                        ) : (
                          <span
                            className="food-timeline-result-inline food-timeline-result-inline--placeholder food-timeline-cell--result"
                            aria-hidden="true"
                          />
                        )}

                        {entry.note.trim() ? (
                          <span className="food-timeline-note-inline food-timeline-cell--note" title={entry.note}>
                            {entry.note}
                          </span>
                        ) : null}
                      </div>
                    </header>
                  </article>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
