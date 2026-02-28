"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { AntiForgetRadarItem, AntiForgetRadarStats } from "@/lib/anti-forget-radar";
import { getCategoryUi } from "@/lib/category-ui";
import { formatDate } from "@/lib/ui-utils";

type AntiForgetPanelProps = {
  isOpen: boolean;
  isSummaryOpen: boolean;
  onClose: () => void;
  hasPremiumAccess: boolean;
  stats: AntiForgetRadarStats;
  blockedFoods: AntiForgetRadarItem[];
  openFoodSummary: (foodId: number, triggerEl: HTMLElement) => void;
  childFirstName?: string | null;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getStatusLabel(food: AntiForgetRadarItem) {
  if (food.isUrgent) return `Urgent · ${food.daysSinceLastTasting} jours`;
  return `Bloqué · ${food.daysSinceLastTasting} jours`;
}

export function AntiForgetPanel({
  isOpen,
  isSummaryOpen,
  onClose,
  hasPremiumAccess,
  stats,
  blockedFoods,
  openFoodSummary,
  childFirstName
}: AntiForgetPanelProps) {
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  if (!isOpen) return null;

  const normalizedFirstName = childFirstName?.trim() || "";
  const panelTitle = normalizedFirstName
    ? `Radar anti-oubli de ${normalizedFirstName}`
    : "Radar anti-oubli";

  return (
    <div className="anti-forget-overlay" onClick={onClose} role="presentation">
      <section
        ref={modalRef}
        className="anti-forget-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anti-forget-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="anti-forget-header">
          <h2 id="anti-forget-title">{panelTitle}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="food-search-close"
            aria-label="Fermer le radar anti-oubli"
            onClick={onClose}
          >
            Fermer
          </button>
        </header>

        <div className="anti-forget-content">
          <p className="anti-forget-intro">
            Aliments en cours sans nouvel essai depuis 7+ jours, priorisés pour relancer la progression.
          </p>

          <ul className="anti-forget-stats" aria-label="Indicateurs du radar anti-oubli">
            <li className="anti-forget-stat-card">
              <span className="anti-forget-stat-label">Bloqués</span>
              <strong className="anti-forget-stat-value">{stats.blockedCount}</strong>
            </li>
            <li className="anti-forget-stat-card anti-forget-stat-card-urgent">
              <span className="anti-forget-stat-label">Urgents</span>
              <strong className="anti-forget-stat-value">{stats.urgentCount}</strong>
            </li>
            <li className="anti-forget-stat-card">
              <span className="anti-forget-stat-label">En cours</span>
              <strong className="anti-forget-stat-value">{stats.inProgressCount}</strong>
            </li>
          </ul>

          {!hasPremiumAccess ? (
            <section className="anti-forget-lock-state" aria-label="Radar anti-oubli premium">
              <h3>Fonction Premium</h3>
              <p>
                Débloque la reprise guidée avec liste priorisée et accès direct au résumé des aliments à relancer.
              </p>
              <Link href="/account" className="anti-forget-upgrade-link">
                Voir mon espace premium
              </Link>
            </section>
          ) : blockedFoods.length === 0 ? (
            <p className="food-search-empty">Aucun aliment bloqué pour le moment. La progression est bien relancée.</p>
          ) : (
            <ul className="anti-forget-list" aria-label="Aliments bloqués à reprendre">
              {blockedFoods.map((food) => (
                <li key={`${food.foodId}-${food.lastTastedOn}`} className="anti-forget-item">
                  <article className="anti-forget-item-card">
                    <div className="anti-forget-item-main">
                      <span className="anti-forget-category-pill" role="img" aria-label={food.categoryName}>
                        {getCategoryUi(food.categoryName).pictogram}
                      </span>
                      <div className="anti-forget-food-copy">
                        <p className="anti-forget-food-name">{food.foodName}</p>
                        <p className="anti-forget-food-meta">
                          {food.tastingCount}/3 • Dernier essai le {formatDate(food.lastTastedOn)}
                        </p>
                      </div>
                    </div>

                    <div className="anti-forget-item-actions">
                      <span
                        className={`anti-forget-status ${food.isUrgent ? "is-urgent" : "is-blocked"}`}
                        aria-label={getStatusLabel(food)}
                      >
                        {getStatusLabel(food)}
                      </span>
                      <button
                        type="button"
                        className="anti-forget-resume-btn"
                        onClick={(event) => openFoodSummary(food.foodId, event.currentTarget)}
                        aria-label={`Reprendre ${food.foodName} (ouvrir le résumé)`}
                      >
                        Reprendre
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
