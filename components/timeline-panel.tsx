"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import type { FoodTimelineEntry, FinalPreferenceValue } from "@/lib/types";
import { DEFAULT_REACTION_TYPE, getReactionOption, getTextureOption } from "@/lib/tasting-metadata";
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

type TimelinePanelProps = {
  isOpen: boolean;
  isSummaryOpen: boolean;
  onClose: () => void;
  timelineEntries: FoodTimelineEntry[];
  finalPreferenceByFoodId: Map<number, FinalPreferenceValue>;
  openFoodSummary: (foodId: number, triggerEl: HTMLElement) => void;
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

export function TimelinePanel({
  isOpen,
  isSummaryOpen,
  onClose,
  timelineEntries,
  finalPreferenceByFoodId,
  openFoodSummary,
  toneByCategory,
  childFirstName
}: TimelinePanelProps) {
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
    if (!isOpen || isSummaryOpen) return;

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
  }, [isOpen, isSummaryOpen]);

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
  const timelineTitle = normalizedFirstName ? `Carnets de bords de ${normalizedFirstName}` : "Carnets de bords";

  return (
    <div className="food-timeline-overlay" onClick={onClose} role="presentation">
      <section
        ref={timelineModalRef}
        className="food-timeline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="food-timeline-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="food-timeline-header">
          <h2 id="food-timeline-title">{timelineTitle}</h2>
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
            <p className="food-search-empty">
              Aucune dégustation enregistrée pour le moment. Utilise les tigres 1/2/3 pour démarrer le carnet.
            </p>
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
                      const textureLabel = textureOption
                        ? `Texture: ${textureOption.shortName}. ${textureOption.description}`
                        : "Texture: Aucune texture";
                      const reactionLabel = reactionOption
                        ? `Réaction observée: ${reactionOption.label}. ${reactionOption.description}`
                        : "Réaction observée: Aucun symptôme";

                      return (
                        <li
                          key={`${entry.foodId}-${entry.slot}-${entry.tastedOn}`}
                          className="food-timeline-entry"
                        >
                          <div className="food-timeline-rail-dot" aria-hidden="true" />
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
                                  className={`food-timeline-category-pill food-timeline-category-inline food-timeline-category-emoji-pill ${toneByCategory[entry.categoryName] || "tone-other"}`}
                                  title={entry.categoryName}
                                  aria-label={entry.categoryName}
                                  role="img"
                                >
                                  {getCategoryPictogram(entry.categoryName)}
                                </span>
                                <span className={`food-timeline-slot-badge slot-${entry.slot}`}>
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
                                  className="food-timeline-meta-chip food-timeline-meta-chip--texture"
                                  role="img"
                                  aria-label={textureLabel}
                                  title={textureLabel}
                                  data-tooltip={textureLabel}
                                >
                                  {textureOption ? (
                                    <Image
                                      src={textureOption.iconSrc}
                                      alt=""
                                      aria-hidden="true"
                                      width={22}
                                      height={22}
                                      className="food-timeline-meta-chip-icon"
                                    />
                                  ) : (
                                      <span className="food-timeline-meta-chip-empty" aria-hidden="true">
                                        ø
                                      </span>
                                    )}
                                </span>

                                <span
                                  className="food-timeline-meta-chip food-timeline-meta-chip--reaction"
                                  role="img"
                                  aria-label={reactionLabel}
                                  title={reactionLabel}
                                  data-tooltip={reactionLabel}
                                >
                                  <span className="food-timeline-meta-chip-emoji" aria-hidden="true">
                                    {reactionOption?.emoji ?? "✅"}
                                  </span>
                                </span>

                                <button
                                  type="button"
                                  className="food-timeline-food-name food-timeline-food-name-inline touch-manipulation appearance-none [-webkit-appearance:none] border-0 bg-transparent p-0 text-left underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.99]"
                                  onClick={(event) => openFoodSummary(entry.foodId, event.currentTarget)}
                                  aria-label={`Ouvrir le résumé de ${entry.foodName}`}
                                  title="Résumé"
                                >
                                  {entry.foodName}
                                </button>

                                {entry.note.trim() ? (
                                  <span className="food-timeline-note-inline" title={entry.note}>
                                    {entry.note}
                                  </span>
                                ) : null}

                                {entry.slot === 3 ? (
                                  <span
                                    className="food-timeline-result-inline"
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
          )}
        </div>
      </section>
    </div>
  );
}
