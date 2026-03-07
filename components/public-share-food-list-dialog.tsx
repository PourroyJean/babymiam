"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicSharePreferenceKey } from "@/lib/types";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type PublicShareFoodListDialogItem = {
  key: string;
  label: string;
  preferenceKey?: PublicSharePreferenceKey;
};

type PublicShareFoodListDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  kicker: string;
  closeLabel: string;
  listAriaLabel: string;
  emptyMessage: string;
  items: PublicShareFoodListDialogItem[];
  dialogClassName?: string;
};

export function PublicShareFoodListDialog({
  isOpen,
  onClose,
  title,
  description,
  kicker,
  closeLabel,
  listAriaLabel,
  emptyMessage,
  items,
  dialogClassName = ""
}: PublicShareFoodListDialogProps) {
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

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

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isMounted || !isOpen) return null;

  return createPortal(
    <div className="public-share-preference-overlay" onClick={onClose} role="presentation">
      <section
        ref={modalRef}
        className={`public-share-preference-modal ${dialogClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-share-preference-title"
        aria-describedby="public-share-preference-description"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="public-share-preference-header">
          <div className="public-share-preference-title-block">
            <p className="public-share-preference-kicker">{kicker}</p>
            <h3 id="public-share-preference-title">{title}</h3>
            <p id="public-share-preference-description">{description}</p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="food-search-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            Fermer
          </button>
        </header>

        <div className="public-share-preference-content">
          {items.length > 0 ? (
            <ul className="public-share-preference-list" aria-label={listAriaLabel}>
              {items.map((item) => (
                <li
                  key={item.key}
                  className={
                    item.preferenceKey
                      ? `public-share-preference-list-item public-share-preference-list-item--${item.preferenceKey}`
                      : "public-share-preference-list-item"
                  }
                >
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-share-preference-empty">{emptyMessage}</p>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
