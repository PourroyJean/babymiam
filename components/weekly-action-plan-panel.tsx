"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { WeeklyActionFocus, WeeklyActionPlanSnapshot } from "@/lib/weekly-action-plan";
import { formatTimelineDayLabel } from "@/lib/ui-utils";

type WeeklyActionPlanPanelProps = {
  isOpen: boolean;
  isSummaryOpen: boolean;
  onClose: () => void;
  hasPremiumAccess: boolean;
  plan: WeeklyActionPlanSnapshot;
  openFoodSummary: (foodId: number, triggerEl: HTMLElement) => void;
  openQuickAddForFood: (foodId: number, foodName: string) => void;
  childFirstName?: string | null;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusLabel(focus: WeeklyActionFocus) {
  if (focus === "retry_blocked") return "Relance prioritaire";
  if (focus === "new_discovery") return "Nouveau test";
  return "Consolidation";
}

function getFocusClass(focus: WeeklyActionFocus, isUrgent: boolean) {
  if (focus === "retry_blocked") return isUrgent ? "is-retry-urgent" : "is-retry";
  if (focus === "new_discovery") return "is-discovery";
  return "is-consolidation";
}

function getExposureLabel(tastingCount: number) {
  if (tastingCount <= 0) return "0/3 essais";
  if (tastingCount >= 3) return "3/3 essais";
  return `${tastingCount}/3 essais`;
}

function getFocusAriaLabel(focus: WeeklyActionFocus, isUrgent: boolean) {
  if (focus !== "retry_blocked") return getFocusLabel(focus);
  return isUrgent ? "Relance prioritaire urgente" : "Relance prioritaire";
}

export function WeeklyActionPlanPanel({
  isOpen,
  isSummaryOpen,
  onClose,
  hasPremiumAccess,
  plan,
  openFoodSummary,
  openQuickAddForFood,
  childFirstName
}: WeeklyActionPlanPanelProps) {
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isSummaryOpen) return;

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const modal = modalRef.current;
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

    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [isOpen, isSummaryOpen]);

  if (!isOpen) return null;

  const normalizedFirstName = childFirstName?.trim() || "";
  const panelTitle = normalizedFirstName ? `Plan 7 jours de ${normalizedFirstName}` : "Plan 7 jours";

  return (
    <div className="weekly-plan-overlay" onClick={onClose} role="presentation">
      <section
        ref={modalRef}
        className="weekly-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-plan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="weekly-plan-header">
          <h2 id="weekly-plan-title">{panelTitle}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="food-search-close"
            aria-label="Fermer le plan 7 jours"
            onClick={onClose}
          >
            Fermer
          </button>
        </header>

        <div className="weekly-plan-content">
          <p className="weekly-plan-intro">
            Chaque jour, une action claire à faire pour garder le rythme de diversification sans surcharge mentale.
          </p>

          <ul className="weekly-plan-stats" aria-label="Indicateurs du plan 7 jours">
            <li className="weekly-plan-stat-card">
              <span className="weekly-plan-stat-label">Relances planifiées</span>
              <strong className="weekly-plan-stat-value">{plan.stats.plannedRetryCount}</strong>
            </li>
            <li className="weekly-plan-stat-card">
              <span className="weekly-plan-stat-label">Nouveaux tests</span>
              <strong className="weekly-plan-stat-value">{plan.stats.plannedDiscoveryCount}</strong>
            </li>
            <li className="weekly-plan-stat-card">
              <span className="weekly-plan-stat-label">Consolidations</span>
              <strong className="weekly-plan-stat-value">{plan.stats.plannedConsolidationCount}</strong>
            </li>
          </ul>

          <p className="weekly-plan-backlog" aria-live="polite">
            Backlog actuel: {plan.stats.blockedBacklogCount} bloqués, dont {plan.stats.urgentBacklogCount} urgents.
          </p>

          {!hasPremiumAccess ? (
            <section className="weekly-plan-lock-state" aria-label="Plan 7 jours premium">
              <h3>Fonction Premium</h3>
              <p>
                Débloque un plan prêt à suivre avec priorités quotidiennes et accès direct aux actions utiles.
              </p>
              <Link href="/account" className="weekly-plan-upgrade-link">
                Voir mon espace premium
              </Link>
            </section>
          ) : plan.items.length === 0 ? (
            <p className="food-search-empty">Aucun aliment à planifier pour le moment.</p>
          ) : (
            <ol className="weekly-plan-list" aria-label="Planification journalière sur 7 jours">
              {plan.items.map((item) => (
                <li key={`${item.day}-${item.foodId}`} className="weekly-plan-item">
                  <article className="weekly-plan-item-card">
                    <header className="weekly-plan-item-head">
                      <p className="weekly-plan-item-day">{formatTimelineDayLabel(item.day)}</p>
                      <span
                        className={`weekly-plan-focus-badge ${getFocusClass(item.focus, item.isUrgent)}`}
                        aria-label={getFocusAriaLabel(item.focus, item.isUrgent)}
                      >
                        {getFocusLabel(item.focus)}
                      </span>
                    </header>

                    <div className="weekly-plan-item-main">
                      <p className="weekly-plan-food-name">{item.foodName}</p>
                      <p className="weekly-plan-food-meta">
                        {item.categoryName} · {getExposureLabel(item.tastingCount)}
                      </p>
                      <p className="weekly-plan-item-reason">{item.reason}</p>
                    </div>

                    <div className="weekly-plan-item-actions">
                      <button
                        type="button"
                        className="weekly-plan-test-now-btn"
                        onClick={() => openQuickAddForFood(item.foodId, item.foodName)}
                        aria-label={`Tester maintenant ${item.foodName}`}
                      >
                        Tester maintenant
                      </button>
                      <button
                        type="button"
                        className="weekly-plan-summary-btn"
                        onClick={(event) => openFoodSummary(item.foodId, event.currentTarget)}
                        aria-label={`Voir le résumé de ${item.foodName}`}
                      >
                        Voir résumé
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
