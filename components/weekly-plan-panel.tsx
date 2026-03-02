"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WeeklyDiscoveryPlanSnapshot, WeeklyPlanFocus } from "@/lib/weekly-discovery-plan";
import { getCategoryUi } from "@/lib/category-ui";
import { formatTimelineDayLabel } from "@/lib/ui-utils";

type WeeklyPlanPanelProps = {
  isOpen: boolean;
  isSummaryOpen: boolean;
  onClose: () => void;
  hasPremiumAccess: boolean;
  plan: WeeklyDiscoveryPlanSnapshot;
  openFoodSummary: (foodId: number, triggerEl: HTMLElement) => void;
  openQuickAddForFood: (foodId: number, foodName: string) => void;
  childFirstName?: string | null;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FOCUS_LABEL: Record<WeeklyPlanFocus, string> = {
  relaunch: "Relance",
  new_discovery: "Découverte",
  allergen_routine: "Allergène",
  consolidation: "Consolidation"
};

const FOCUS_CLASS: Record<WeeklyPlanFocus, string> = {
  relaunch: "weekly-plan-focus-relaunch",
  new_discovery: "weekly-plan-focus-discovery",
  allergen_routine: "weekly-plan-focus-allergen",
  consolidation: "weekly-plan-focus-consolidation"
};

type WeeklyPlanFilterKey = "relaunch" | "discovery" | "allergen" | "consolidation";

export function WeeklyPlanPanel({
  isOpen,
  isSummaryOpen,
  onClose,
  hasPremiumAccess,
  plan,
  openFoodSummary,
  openQuickAddForFood,
  childFirstName
}: WeeklyPlanPanelProps) {
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeFilter, setActiveFilter] = useState<WeeklyPlanFilterKey | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
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

  useEffect(() => {
    if (isOpen) return;
    setActiveFilter(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const relaunchCount = plan.items.filter((item) => item.focus === "relaunch" && item.isAbandonedAtGeneration).length;
  const discoveryCount = plan.items.filter((item) => item.focus === "new_discovery").length;
  const allergenCount = plan.items.filter((item) => item.focus === "allergen_routine").length;
  const consolidationCount = plan.items.filter((item) => item.focus === "consolidation").length;

  const visibleItems = (() => {
    if (!activeFilter) return plan.items;
    if (activeFilter === "relaunch") {
      return plan.items.filter((item) => item.focus === "relaunch" && item.isAbandonedAtGeneration);
    }
    if (activeFilter === "discovery") {
      return plan.items.filter((item) => item.focus === "new_discovery");
    }
    if (activeFilter === "allergen") {
      return plan.items.filter((item) => item.focus === "allergen_routine");
    }
    return plan.items.filter((item) => item.focus === "consolidation");
  })();

  const hasFilteredEmptyState = hasPremiumAccess && plan.items.length > 0 && visibleItems.length === 0;

  const normalizedFirstName = childFirstName?.trim() || "";
  const panelTitle = normalizedFirstName ? `Plan 7 jours de ${normalizedFirstName}` : "Plan 7 jours";

  function toggleFilter(filter: WeeklyPlanFilterKey) {
    setActiveFilter((current) => (current === filter ? null : filter));
  }

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
            Une feuille de route claire pour savoir quoi tester chaque jour, sans hésiter.
          </p>

          <ul className="weekly-plan-stats" aria-label="Indicateurs du plan 7 jours">
            <li>
              <button
                type="button"
                className={`weekly-plan-stat-card weekly-plan-filter-btn weekly-plan-filter-abandon ${
                  activeFilter === "relaunch" ? "is-active" : ""
                }`}
                aria-pressed={activeFilter === "relaunch"}
                onClick={() => toggleFilter("relaunch")}
              >
                <span className="weekly-plan-stat-label">Relances</span>
                <strong className="weekly-plan-stat-value">{relaunchCount}</strong>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`weekly-plan-stat-card weekly-plan-filter-btn weekly-plan-filter-discovery ${
                  activeFilter === "discovery" ? "is-active" : ""
                }`}
                aria-pressed={activeFilter === "discovery"}
                onClick={() => toggleFilter("discovery")}
              >
                <span className="weekly-plan-stat-label">Découvertes</span>
                <strong className="weekly-plan-stat-value">{discoveryCount}</strong>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`weekly-plan-stat-card weekly-plan-filter-btn weekly-plan-filter-allergen ${
                  activeFilter === "allergen" ? "is-active" : ""
                }`}
                aria-pressed={activeFilter === "allergen"}
                onClick={() => toggleFilter("allergen")}
              >
                <span className="weekly-plan-stat-label">Allergènes à suivre</span>
                <strong className="weekly-plan-stat-value">{allergenCount}</strong>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`weekly-plan-stat-card weekly-plan-filter-btn weekly-plan-filter-consolidation ${
                  activeFilter === "consolidation" ? "is-active" : ""
                }`}
                aria-pressed={activeFilter === "consolidation"}
                onClick={() => toggleFilter("consolidation")}
              >
                <span className="weekly-plan-stat-label">Consolidation</span>
                <strong className="weekly-plan-stat-value">{consolidationCount}</strong>
              </button>
            </li>
          </ul>

          {!hasPremiumAccess ? (
            <section className="weekly-plan-lock-state" aria-label="Plan 7 jours premium">
              <h3>Fonction Premium</h3>
              <p>
                Débloque un plan quotidien prêt à l&apos;emploi avec priorités de relance, découverte et routine
                allergènes.
              </p>
              <Link href="/account" className="weekly-plan-upgrade-link">
                Voir mon espace premium
              </Link>
            </section>
          ) : plan.items.length === 0 ? (
            <p className="food-search-empty">Pas assez de données pour générer un plan. Ajoute une première dégustation.</p>
          ) : hasFilteredEmptyState ? (
            <p className="food-search-empty">
              Aucun aliment pour ce filtre. Re-clique sur le filtre pour revenir à la vue complète.
            </p>
          ) : (
            <ul className="weekly-plan-list" aria-label="Planification diversification sur 7 jours">
              {visibleItems.map((item) => (
                <li key={`${item.date}-${item.foodId}-${item.focus}`} className="weekly-plan-item">
                  <article className="weekly-plan-item-card">
                    <div className="weekly-plan-item-head">
                      <p className="weekly-plan-day">{formatTimelineDayLabel(item.date)}</p>
                      <span className={`weekly-plan-focus ${FOCUS_CLASS[item.focus]}`}>{FOCUS_LABEL[item.focus]}</span>
                    </div>

                    <div className="weekly-plan-item-main">
                      <span className="weekly-plan-category-pill" role="img" aria-label={item.categoryName}>
                        {getCategoryUi(item.categoryName).pictogram}
                      </span>
                      <div className="weekly-plan-food-copy">
                        <p className="weekly-plan-food-name">{item.foodName}</p>
                        <p className="weekly-plan-food-meta">
                          {item.categoryName} · {item.tastingCount}/3 essais
                        </p>
                        <p className="weekly-plan-food-reason">{item.reason}</p>
                      </div>
                    </div>

                    <div className="weekly-plan-item-actions">
                      <button
                        type="button"
                        className="weekly-plan-test-btn"
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
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
