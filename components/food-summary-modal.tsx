"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { setNoteAction } from "@/app/actions";
import type { FoodTastingEntry } from "@/lib/types";

type FoodSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  foodId: number;
  foodName: string;
  categoryName: string;
  categoryToneClass: string;
  tastings: FoodTastingEntry[];
  tastingCount: number;
  finalPreference: -1 | 0 | 1;
  initialNote: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FRENCH_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatShortFrenchDate(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return FRENCH_SHORT_DATE_FORMATTER.format(parsed);
}

function getTastingIconSrc(liked: boolean) {
  return liked ? "/smiley_ok.png" : "/smiley_ko.png";
}

function getFinalPreferenceImageSrc(preference: -1 | 0 | 1) {
  if (preference === 1) return "/pouce_YES.png";
  if (preference === -1) return "/pouce_NO.png";
  return "/pouce_NEUTRE.png";
}

function getFinalPreferenceLabel(preference: -1 | 0 | 1) {
  if (preference === 1) return "Adoré";
  if (preference === -1) return "Pas aimé";
  return "Neutre";
}

export function FoodSummaryModal({
  isOpen,
  onClose,
  foodId,
  foodName,
  categoryName,
  categoryToneClass,
  tastings,
  tastingCount,
  finalPreference,
  initialNote
}: FoodSummaryModalProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [draftNote, setDraftNote] = useState(initialNote);
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDraftNote(initialNote);
  }, [foodId, initialNote, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Capture phase so we close the summary without letting underlying overlays react to Escape.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose]);

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

  function saveNote() {
    const trimmedNote = draftNote.trim();
    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("note", trimmedNote);

    startTransition(async () => {
      await setNoteAction(formData);
      router.refresh();
      onClose();
    });
  }

  if (!isMounted || !isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[2400] bg-[#1f1810]/45 sm:grid sm:place-items-center"
      role="presentation"
      onClick={onClose}
    >
      <section
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`food-summary-title-${foodId}`}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-[#e1d2bc] bg-[#fffdf8] p-4 shadow-2xl sm:relative sm:inset-auto sm:w-[min(100%,34rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id={`food-summary-title-${foodId}`} className="m-0 truncate text-xl font-extrabold text-[#3b3128]">
              {foodName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`food-timeline-category-pill ${categoryToneClass}`}>{categoryName}</span>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-[#bcae99] bg-white text-[#4c4136] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]"
            onClick={onClose}
            aria-label="Fermer le résumé"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </header>

        <section aria-label="Historique des dégustations" className="grid gap-2">
          <h3 className="m-0 text-base font-extrabold text-[#5f4323]">📖 Historique</h3>

          {tastings.length === 0 ? (
            <p className="m-0 rounded-xl border border-dashed border-[#deceb6] bg-[#fff8ef] px-3 py-2 text-sm font-semibold text-[#6d6255]">
              Aucune dégustation enregistrée.
            </p>
          ) : (
            <ol className="m-0 grid list-none gap-2 p-0">
              {tastings.slice(0, 3).map((tasting) => (
                  <li
                    key={`${foodId}-${tasting.slot}-${tasting.tastedOn}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e8dcc9] bg-white/80 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Image
                        src={getTastingIconSrc(tasting.liked)}
                        alt={tasting.liked ? "Tigre OK" : "Tigre KO"}
                        width={28}
                        height={28}
                        unoptimized
                        className="h-7 w-7 object-contain"
                      />
                      <p className="m-0 text-sm font-extrabold text-[#3b3128]">Tigre {tasting.slot}/3</p>
                    </div>
                    <p className="m-0 text-sm font-semibold text-[#6c5b48]">{formatShortFrenchDate(tasting.tastedOn)}</p>
                  </li>
                ))}
            </ol>
          )}
        </section>

        {tastingCount === 3 ? (
          <section aria-label="Résultat final" className="mt-4 grid gap-2">
            <h3 className="m-0 text-base font-extrabold text-[#5f4323]">🏁 Résultat final</h3>
            <div className="flex items-center gap-3 rounded-xl border border-[#e8dcc9] bg-white/80 px-3 py-2">
              <Image
                src={getFinalPreferenceImageSrc(finalPreference)}
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 object-contain"
              />
              <p className="m-0 text-sm font-extrabold text-[#3b3128]">{getFinalPreferenceLabel(finalPreference)}</p>
            </div>
          </section>
        ) : null}

        <section className="mt-4 grid gap-2">
          <h3 className="m-0 text-base font-extrabold text-[#5f4323]">📝 Notes</h3>
          <textarea
            value={draftNote}
            onChange={(event) => setDraftNote(event.currentTarget.value)}
            placeholder="Écrire une note"
            rows={4}
            className="w-full resize-y rounded-xl border border-[#ddcfbb] bg-white px-3 py-2 text-base text-[#40362c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
            disabled={isPending}
            aria-label="Note"
          />

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#ddcfbb] bg-white px-3 py-2 text-sm font-semibold text-[#554a3f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveNote}
              disabled={isPending}
              className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#b89056] bg-[#f6ead4] px-3 py-2 text-sm font-semibold text-[#5f4323] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>

          {isPending ? <p className="m-0 text-sm font-semibold text-[#7b6648]">Enregistrement…</p> : null}
        </section>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
