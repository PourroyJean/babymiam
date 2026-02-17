"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { saveTastingEntryAction, setNoteAction } from "@/app/actions";
import type { FoodTastingEntry } from "@/lib/types";
import {
  DEFAULT_REACTION_TYPE,
  REACTION_OPTIONS,
  TEXTURE_OPTIONS,
  type ReactionType,
  type TextureLevel
} from "@/lib/tasting-metadata";

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
  onCycleFinalPreference?: (foodId: number) => void;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

function getNextFinalPreference(current: -1 | 0 | 1): -1 | 0 | 1 {
  if (current === 0) return 1;
  if (current === 1) return -1;
  return 0;
}

function getFinalPreferenceVisualClass(preference: -1 | 0 | 1) {
  if (preference === 1) return "border-emerald-500";
  if (preference === -1) return "border-rose-500";
  return "border-[#b9ac9b]";
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
  initialNote,
  onCycleFinalPreference
}: FoodSummaryModalProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [draftNote, setDraftNote] = useState(initialNote);
  const [draftTastingLiked, setDraftTastingLiked] = useState<Record<number, boolean>>({});
  const [draftTastingNotes, setDraftTastingNotes] = useState<Record<number, string>>({});
  const [draftTastingDates, setDraftTastingDates] = useState<Record<number, string>>({});
  const [draftTastingTextures, setDraftTastingTextures] = useState<Record<number, TextureLevel | null>>({});
  const [draftTastingReactions, setDraftTastingReactions] = useState<Record<number, ReactionType>>({});
  const [saveError, setSaveError] = useState("");
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDraftNote(initialNote);
    setDraftTastingLiked(Object.fromEntries(tastings.map((tasting) => [tasting.slot, tasting.liked])));
    setDraftTastingDates(Object.fromEntries(tastings.map((tasting) => [tasting.slot, tasting.tastedOn])));
    setDraftTastingNotes(Object.fromEntries(tastings.map((tasting) => [tasting.slot, tasting.note])));
    setDraftTastingTextures(Object.fromEntries(tastings.map((tasting) => [tasting.slot, tasting.textureLevel ?? null])));
    setDraftTastingReactions(
      Object.fromEntries(tastings.map((tasting) => [tasting.slot, tasting.reactionType ?? DEFAULT_REACTION_TYPE]))
    );
    setSaveError("");
  }, [foodId, initialNote, isOpen, tastings]);

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
    const foodNoteFormData = new FormData();
    foodNoteFormData.set("foodId", String(foodId));
    foodNoteFormData.set("note", trimmedNote);

    startTransition(async () => {
      setSaveError("");
      try {
        for (const tasting of tastings) {
          const updatedLiked = draftTastingLiked[tasting.slot] ?? tasting.liked;
          const updatedTastedOn = (draftTastingDates[tasting.slot] || tasting.tastedOn).trim();
          const updatedNote = draftTastingNotes[tasting.slot] ?? tasting.note;
          const hasDraftTextureLevel = Object.prototype.hasOwnProperty.call(draftTastingTextures, tasting.slot);
          const updatedTextureLevel = hasDraftTextureLevel
            ? draftTastingTextures[tasting.slot]
            : (tasting.textureLevel ?? null);
          const updatedReactionType =
            draftTastingReactions[tasting.slot] ?? tasting.reactionType ?? DEFAULT_REACTION_TYPE;
          const normalizedExistingReaction = tasting.reactionType ?? DEFAULT_REACTION_TYPE;

          if (
            updatedLiked === tasting.liked &&
            updatedTastedOn === tasting.tastedOn &&
            updatedNote.trim() === tasting.note.trim() &&
            updatedTextureLevel === (tasting.textureLevel ?? null) &&
            updatedReactionType === normalizedExistingReaction
          ) {
            continue;
          }

          const tastingFormData = new FormData();
          tastingFormData.set("foodId", String(foodId));
          tastingFormData.set("slot", String(tasting.slot));
          tastingFormData.set("liked", updatedLiked ? "yes" : "no");
          tastingFormData.set("tastedOn", updatedTastedOn);
          tastingFormData.set("note", updatedNote.trim());
          if (updatedTextureLevel !== null) {
            tastingFormData.set("textureLevel", String(updatedTextureLevel));
          }
          tastingFormData.set("reactionType", String(updatedReactionType));

          const tastingResult = await saveTastingEntryAction(tastingFormData);
          if (!tastingResult.ok) {
            setSaveError(tastingResult.error || "Impossible d'enregistrer une note de test.");
            return;
          }
        }

        await setNoteAction(foodNoteFormData);
        router.refresh();
        onClose();
      } catch {
        setSaveError("Impossible d'enregistrer les notes pour le moment.");
      }
    });
  }

  if (!isMounted || !isOpen) return null;
  const nextFinalPreference = getNextFinalPreference(finalPreference);
  const nextFinalPreferenceLabel = getFinalPreferenceLabel(nextFinalPreference);

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
              {tastings.slice(0, 3).map((tasting) => {
                const liked = draftTastingLiked[tasting.slot] ?? tasting.liked;
                const hasDraftTextureLevel = Object.prototype.hasOwnProperty.call(draftTastingTextures, tasting.slot);
                const textureLevel = hasDraftTextureLevel
                  ? draftTastingTextures[tasting.slot]
                  : (tasting.textureLevel ?? null);
                const reactionType =
                  draftTastingReactions[tasting.slot] ?? tasting.reactionType ?? DEFAULT_REACTION_TYPE;

                return (
                  <li
                    key={`${foodId}-${tasting.slot}-${tasting.tastedOn}`}
                    className="flex flex-col gap-2 rounded-lg border border-[#e1d8ca] bg-[#f5f4f1] px-3 py-2 shadow-[0_1px_2px_rgba(76,65,54,0.06)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftTastingLiked((current) => ({
                              ...current,
                              [tasting.slot]: !liked
                            }));
                          }}
                          disabled={isPending}
                          aria-label={`Basculer le résultat du tigre ${tasting.slot}/3`}
                          title={`Passer à ${liked ? "pas aimé" : "aimé"}`}
                          className="touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dacbb6] bg-[#fffbf4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          <Image
                            src={getTastingIconSrc(liked)}
                            alt={liked ? "Tigre OK" : "Tigre KO"}
                            width={28}
                            height={28}
                            unoptimized
                            className="h-7 w-7 object-contain"
                          />
                        </button>
                        <p className="m-0 text-sm font-extrabold text-[#3b3128]">Tigre {tasting.slot}/3</p>
                      </div>
                      <input
                        type="date"
                        value={draftTastingDates[tasting.slot] ?? tasting.tastedOn}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setDraftTastingDates((current) => ({
                            ...current,
                            [tasting.slot]: nextValue
                          }));
                        }}
                        disabled={isPending}
                        className="h-8 rounded-lg border border-[#dfd1ba] bg-[#fffbf4] px-2 text-[0.8rem] font-semibold text-[#6c5b48] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
                        aria-label={`Date du ${tasting.slot}/3`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={textureLevel === null ? "" : String(textureLevel)}
                        onChange={(event) => {
                          const raw = event.currentTarget.value.trim();
                          setDraftTastingTextures((current) => ({
                            ...current,
                            [tasting.slot]: raw ? (Number(raw) as TextureLevel) : null
                          }));
                        }}
                        disabled={isPending}
                        className="h-8 rounded-lg border border-[#dfd1ba] bg-[#fffbf4] px-2 text-[0.8rem] font-semibold text-[#6c5b48] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
                        aria-label={`Texture du ${tasting.slot}/3`}
                      >
                        <option value="">Texture non renseignée</option>
                        {TEXTURE_OPTIONS.map((option) => (
                          <option key={option.level} value={option.level}>
                            {option.level} - {option.shortName}
                          </option>
                        ))}
                      </select>

                      <select
                        value={String(reactionType)}
                        onChange={(event) => {
                          const nextValue = Number(event.currentTarget.value) as ReactionType;
                          setDraftTastingReactions((current) => ({
                            ...current,
                            [tasting.slot]: nextValue
                          }));
                        }}
                        disabled={isPending}
                        className="h-8 rounded-lg border border-[#dfd1ba] bg-[#fffbf4] px-2 text-[0.8rem] font-semibold text-[#6c5b48] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
                        aria-label={`Réaction du ${tasting.slot}/3`}
                      >
                        {REACTION_OPTIONS.map((option) => (
                          <option key={option.type} value={option.type}>
                            {option.emoji} {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="text"
                      value={draftTastingNotes[tasting.slot] ?? tasting.note}
                      onChange={(event) => {
                        const newValue = event.currentTarget.value;
                        setDraftTastingNotes((current) => ({
                          ...current,
                          [tasting.slot]: newValue
                        }));
                      }}
                      placeholder="Ajouter une note"
                      disabled={isPending}
                      className="m-0 inline-flex h-9 min-h-0 min-w-0 w-full items-center rounded-lg border border-[#dfd1ba] bg-[#fffbf4] px-2.5 py-1 text-left text-sm font-semibold leading-snug text-[#6c5b48] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
                      aria-label={`Note du ${tasting.slot}/3`}
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {tastingCount === 3 ? (
          <section aria-label="Résultat final" className="mt-4 grid gap-2">
            <h3 className="m-0 text-base font-extrabold text-[#5f4323]">🏁 Résultat final</h3>
            <button
              type="button"
              onClick={() => onCycleFinalPreference?.(foodId)}
              aria-pressed={finalPreference !== 0}
              aria-label={`Préférence finale pour ${foodName}: ${getFinalPreferenceLabel(finalPreference)}. Appuyer pour passer à ${nextFinalPreferenceLabel}.`}
              title={`Préférence finale: ${getFinalPreferenceLabel(finalPreference)} (prochain état: ${nextFinalPreferenceLabel})`}
              className="touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 bg-[#fcfbf9] ${getFinalPreferenceVisualClass(finalPreference)}`}
              >
                <Image
                  src={getFinalPreferenceImageSrc(finalPreference)}
                  alt=""
                  aria-hidden="true"
                  width={32}
                  height={32}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </span>
            </button>
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
          {saveError ? <p className="m-0 text-sm font-semibold text-rose-700">{saveError}</p> : null}
        </section>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
