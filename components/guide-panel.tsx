"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AgeGuidancePanel } from "@/components/age-guidance-panel";
import type { AgeGuidanceSnapshot } from "@/lib/age-guidance";

type GuidePanelProps = {
  guidance: AgeGuidanceSnapshot;
  isOpen: boolean;
  hasPremiumAccess: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function GuidePanel({ guidance, isOpen, hasPremiumAccess, onClose }: GuidePanelProps) {
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
    if (!isOpen) return;

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
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="guide-panel-overlay" onClick={onClose} role="presentation">
      <section
        ref={modalRef}
        className="guide-panel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="guide-panel-header">
          <h2 id="guide-panel-title">Le Guide</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="food-search-close"
            aria-label="Fermer le guide"
            onClick={onClose}
          >
            Fermer
          </button>
        </header>

        <div className="guide-panel-content">
          {!hasPremiumAccess ? (
            <section className="guide-panel-lock-state" aria-label="Le Guide premium">
              <h3>Fonction Premium</h3>
              <p>
                Débloque le guide par âge avec repères de textures, priorités du moment et rappels cuisine.
              </p>
              <Link href="/account" className="guide-panel-upgrade-link">
                Voir mon espace premium
              </Link>
            </section>
          ) : (
            <AgeGuidancePanel guidance={guidance} />
          )}
        </div>
      </section>
    </div>
  );
}
