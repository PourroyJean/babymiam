"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import type { FinalPreferenceValue, FoodTimelineEntry } from "@/lib/types";
import { DEFAULT_REACTION_TYPE, getReactionOption, getTextureOption } from "@/lib/tasting-metadata";
import {
  FRENCH_COLLATOR,
  formatTimelineDayLabel,
  getFinalTimelineToneClass,
  getTimelineDateTimestamp,
  getTimelineTigerIcon
} from "@/lib/ui-utils";
import { getCategoryUi } from "@/lib/category-ui";

type PublicShareTimelinePanelProps = {
  isOpen: boolean;
  isDetailOpen: boolean;
  onClose: () => void;
  timelineEntries: FoodTimelineEntry[];
  finalPreferenceByFoodId: Map<number, FinalPreferenceValue>;
  onOpenFoodDetail: (foodId: number) => void;
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

function buildFoodDetailAriaLabel(foodName: string, slot: number) {
  return `Ouvrir le détail de ${foodName}, essai ${slot}`;
}

export function PublicShareTimelinePanel({
  isOpen,
  isDetailOpen,
  onClose,
  timelineEntries,
  finalPreferenceByFoodId,
  onOpenFoodDetail,
  toneByCategory,
  childFirstName
}: PublicShareTimelinePanelProps) {
  const timelineModalRef = useRef<HTMLElement>(null);
  const timelineCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      timelineCloseRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isDetailOpen) return;

    function trapTimelineFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const modal = timelineModalRef.current;
      if (!modal) return;

      const focusableElements = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement || !modal.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", trapTimelineFocus);
    return () => document.removeEventListener("keydown", trapTimelineFocus);
  }, [isOpen, isDetailOpen]);

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

  if (!isOpen) return null;

  const normalizedFirstName = childFirstName?.trim() || "";
  const timelineTitle = normalizedFirstName
    ? `Carnets de bords de ${normalizedFirstName}`
    : "Carnets de bords";

  return (
    <div className="food-timeline-overlay" onClick={onClose} role="presentation">
      <section
        ref={timelineModalRef}
        className="food-timeline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-share-timeline-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="food-timeline-header">
          <h2 id="public-share-timeline-title">{timelineTitle}</h2>
          <button
            ref={timelineCloseRef}
            type="button"
            className="food-search-close"
            aria-label="Fermer le carnet de bord"
            onClick={onClose}
          >
            Fermer
          </button>
        </header>

        <div className="food-timeline-content">
          {timelineGroups.length === 0 ? (
            <p className="food-search-empty">Aucune dégustation enregistrée pour le moment.</p>
          ) : (
            <ol className="food-timeline-day-list">
              {timelineGroups.map((group) => (
                <li key={group.day} className="food-timeline-day-item">
                  <h3 className="food-timeline-day-title">{group.label}</h3>
                  <ol className="food-timeline-entry-list">
                    {group.entries.map((entry) => {
                      const entryFinalPreference = finalPreferenceByFoodId.get(entry.foodId) ?? 0;
                      const textureOption = getTextureOption(entry.textureLevel);
                      const reactionOption = getReactionOption(entry.reactionType ?? DEFAULT_REACTION_TYPE);
                      const textureLabel = `Texture: ${textureOption.shortName}. ${textureOption.description}`;
                      const reactionLabel = reactionOption
                        ? `Réaction observée: ${reactionOption.label}. ${reactionOption.description}`
                        : "Réaction observée: Aucun symptôme";

                      return (
                        <li
                          key={`${entry.foodId}-${entry.slot}-${entry.tastedOn}`}
                          className="food-timeline-entry"
                        >
                          <article
                            className={`food-timeline-card ${
                              entry.slot === 3
                                ? `food-timeline-card--final ${getFinalTimelineToneClass(entryFinalPreference)}`
                                : ""
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

                                <button
                                  type="button"
                                  className="food-timeline-food-name food-timeline-food-name-inline food-timeline-cell--name touch-manipulation appearance-none [-webkit-appearance:none] border-0 bg-transparent p-0 text-left underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.99]"
                                  onClick={() => onOpenFoodDetail(entry.foodId)}
                                  aria-label={buildFoodDetailAriaLabel(entry.foodName, entry.slot)}
                                  title="Détail"
                                >
                                  {entry.foodName}
                                </button>

                                <span className={`food-timeline-slot-badge food-timeline-cell--slot slot-${entry.slot}`}>
                                  <Image
                                    src={getTimelineTigerIcon(entry.liked)}
                                    alt=""
                                    aria-hidden="true"
                                    width={20}
                                    height={20}
                                    className="food-timeline-slot-icon"
                                  />
                                  <span className="sr-only">Essai {entry.slot}</span>
                                </span>

                                <span
                                  className="food-timeline-meta-chip food-timeline-meta-chip--texture food-timeline-cell--texture"
                                  title={textureLabel}
                                  aria-label={textureLabel}
                                >
                                  <span className="food-timeline-meta-chip-icon">{textureOption.shortName}</span>
                                </span>

                                <span
                                  className="food-timeline-meta-chip food-timeline-meta-chip--reaction food-timeline-cell--reaction"
                                  title={reactionLabel}
                                  aria-label={reactionLabel}
                                >
                                  <span className="food-timeline-meta-chip-emoji" aria-hidden="true">
                                    {reactionOption?.emoji || "○"}
                                  </span>
                                </span>

                                <span className="food-timeline-note-inline food-timeline-cell--note" title={entry.note}>
                                  {entry.note || "Aucune note"}
                                </span>
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
          )}
        </div>
      </section>
    </div>
  );
}
