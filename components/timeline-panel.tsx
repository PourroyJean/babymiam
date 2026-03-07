"use client";

import { useEffect, useRef } from "react";
import type { FoodTimelineEntry, FinalPreferenceValue } from "@/lib/types";
import { FoodTimelineFeed } from "@/components/food-timeline-feed";

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
          <FoodTimelineFeed
            timelineEntries={timelineEntries}
            finalPreferenceByFoodId={finalPreferenceByFoodId}
            toneByCategory={toneByCategory}
            emptyMessage="Aucune dégustation enregistrée pour le moment. Utilise les tigres 1/2/3 pour démarrer le carnet."
            onFoodClick={openFoodSummary}
          />
        </div>
      </section>
    </div>
  );
}
