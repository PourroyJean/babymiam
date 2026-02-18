"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteTastingEntryAction, saveTastingEntryAction } from "@/app/actions";
import { Pencil } from "lucide-react";
import type { FoodTastingEntry } from "@/lib/types";
import { TastingEntryFormFields } from "@/components/tasting-entry-form-fields";
import {
  DEFAULT_REACTION_TYPE,
  type ReactionType,
  type TextureLevel
} from "@/lib/tasting-metadata";
import {
  formatDate,
  getFinalPreferenceImageSrc,
  getFinalPreferenceLabel,
  getFinalPreferenceVisualClass,
  getNextFinalPreference,
  getTodayIsoDate
} from "@/lib/ui-utils";

type VegetableRowProps = {
  foodId: number;
  name: string;
  tastings: FoodTastingEntry[];
  tastingCount: number;
  finalPreference: -1 | 0 | 1;
  onCycleFinalPreference: (foodId: number) => void;
  onOpenFoodSummary?: (foodId: number, triggerEl: HTMLElement) => void;
  childFirstName?: string | null;
  isFinalPreferenceSaving?: boolean;
};

const ACTION_BUTTON_BASE_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const FIRST_BITE_BUTTON_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-[188px] min-h-[44px] items-center justify-center whitespace-nowrap rounded-full border border-[#e8d8b8] bg-[#f6ead4] px-4 py-2 text-sm font-semibold text-[#6c4b1b] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const SLOT_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 bg-[#fcfbf9] p-0";

const META_BUTTON_BASE_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const META_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-[#fcfbf9]";

export const VegetableRow = memo(function VegetableRow({
  foodId,
  name,
  tastings,
  tastingCount,
  finalPreference,
  onCycleFinalPreference,
  onOpenFoodSummary,
  childFirstName = null,
  isFinalPreferenceSaving = false
}: VegetableRowProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSlot, setEditorSlot] = useState<1 | 2 | 3 | null>(null);
  const [editorLiked, setEditorLiked] = useState<"yes" | "no" | null>(null);
  const [editorDate, setEditorDate] = useState("");
  const [editorTextureLevel, setEditorTextureLevel] = useState<TextureLevel | null>(null);
  const [editorReactionType, setEditorReactionType] = useState<ReactionType>(DEFAULT_REACTION_TYPE);
  const [editorNote, setEditorNote] = useState("");
  const [editorError, setEditorError] = useState("");
  const [isEditorPending, startEditorTransition] = useTransition();

  const tastingsBySlot = useMemo(() => {
    const slotMap = new Map<1 | 2 | 3, FoodTastingEntry>();
    for (const tasting of tastings) {
      slotMap.set(tasting.slot, tasting);
    }
    return slotMap;
  }, [tastings]);

  const maxFilledSlot = useMemo(
    () => tastings.reduce((maxSlot, tasting) => Math.max(maxSlot, tasting.slot), 0),
    [tastings]
  );
  const nextCreatableSlot = useMemo(() => {
    for (const slot of [1, 2, 3] as const) {
      if (!tastingsBySlot.has(slot)) return slot;
    }
    return null;
  }, [tastingsBySlot]);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditorSlot(null);
    setEditorLiked(null);
    setEditorDate("");
    setEditorTextureLevel(null);
    setEditorReactionType(DEFAULT_REACTION_TYPE);
    setEditorNote("");
    setEditorError("");
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isEditorOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeEditor();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeEditor, isEditorOpen]);

  useEffect(() => {
    if (!isEditorOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditorOpen]);

  const currentFinalPreferenceLabel = getFinalPreferenceLabel(finalPreference);
  const nextFinalPreference = getNextFinalPreference(finalPreference);
  const nextFinalPreferenceLabel = getFinalPreferenceLabel(nextFinalPreference);
  const canShowFinalPreference = tastingCount === 3;
  const childLabel = childFirstName?.trim() || "bébé";

  function openEditor(slot: 1 | 2 | 3) {
    const existing = tastingsBySlot.get(slot);

    setEditorSlot(slot);
    setEditorLiked(existing ? (existing.liked ? "yes" : "no") : null);
    setEditorDate(existing?.tastedOn || getTodayIsoDate());
    setEditorTextureLevel(existing?.textureLevel ?? null);
    setEditorReactionType(existing?.reactionType ?? DEFAULT_REACTION_TYPE);
    setEditorNote(existing?.note ?? "");
    setEditorError("");
    setIsEditorOpen(true);
  }

  function openSequentialEditor(requestedSlot: 1 | 2 | 3) {
    const hasEntryOnRequestedSlot = tastingsBySlot.has(requestedSlot);
    if (hasEntryOnRequestedSlot || nextCreatableSlot === null) {
      openEditor(requestedSlot);
      return;
    }

    // Any neutral tiger click opens the next available slot from left to right.
    openEditor(nextCreatableSlot);
  }

  function saveEntry() {
    if (!editorSlot) return;
    if (!editorLiked) {
      setEditorError(`Choisis si ${childLabel} a aimé ou non.`);
      return;
    }

    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("slot", String(editorSlot));
    formData.set("liked", editorLiked);
    formData.set("tastedOn", editorDate || getTodayIsoDate());
    formData.set("note", editorNote.trim());
    if (editorTextureLevel !== null) {
      formData.set("textureLevel", String(editorTextureLevel));
    }
    formData.set("reactionType", String(editorReactionType));

    startEditorTransition(async () => {
      const result = await saveTastingEntryAction(formData);
      if (!result.ok) {
        setEditorError(result.error || "Impossible d'enregistrer cette entrée.");
        return;
      }

      closeEditor();
      router.refresh();
    });
  }

  function deleteEntry() {
    if (!editorSlot) return;

    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("slot", String(editorSlot));

    startEditorTransition(async () => {
      const result = await deleteTastingEntryAction(formData);
      if (!result.ok) {
        setEditorError(result.error || "Impossible de supprimer cette entrée.");
        return;
      }

      closeEditor();
      router.refresh();
    });
  }

  const activeEditorEntry = editorSlot ? tastingsBySlot.get(editorSlot) : null;
  const canDeleteActiveEntry =
    Boolean(activeEditorEntry) && editorSlot !== null && editorSlot === maxFilledSlot;

  const editor = isEditorOpen && editorSlot ? (
    <div
      className="fixed inset-0 z-[2300] bg-[#1f1810]/45 sm:grid sm:place-items-center"
      role="presentation"
      onClick={closeEditor}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tasting-editor-title-${foodId}-${editorSlot}`}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-[#e1d2bc] bg-[#fffdf8] p-4 shadow-2xl sm:relative sm:inset-auto sm:w-[min(100%,34.5rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3">
          <h2 id={`tasting-editor-title-${foodId}-${editorSlot}`} className="m-0 text-base font-bold text-[#3b3128]">
            {name} · Entrée {editorSlot}
          </h2>
          <p className="m-0 mt-1 text-sm text-[#6c5b48]">
            {activeEditorEntry ? "Modifier cette dégustation." : "Ajouter une dégustation."}
          </p>
        </header>

        <div className="grid gap-4">
          <div className="quick-add-right-column">
            <TastingEntryFormFields
              liked={editorLiked === "yes" ? "ok" : editorLiked === "no" ? "ko" : null}
              onLikedChange={(value) => {
                setEditorLiked(value === "ok" ? "yes" : "no");
              }}
              tigerAriaLabels={{ ok: "Oui", ko: "Non" }}
              likedQuestionLabel={`${childLabel} a aimé ?`}
              likedGroupAriaLabel={`Choix de réaction pour ${childLabel}`}
              tastedOn={editorDate}
              onTastedOnChange={setEditorDate}
              tastedOnLabel="Date de dégustation"
              tastedOnAriaLabel="Date de dégustation"
              textureLevel={editorTextureLevel}
              onTextureLevelChange={setEditorTextureLevel}
              reactionType={editorReactionType}
              onReactionTypeChange={(value) => setEditorReactionType(value)}
              note={editorNote}
              onNoteChange={setEditorNote}
              disabled={isEditorPending}
              idPrefix={`tasting-editor-${foodId}-${editorSlot}`}
            />
          </div>

          {editorError ? <p className="m-0 text-sm font-semibold text-rose-700">{editorError}</p> : null}

          <div className="flex flex-wrap justify-between gap-2">
            <div>
              {canDeleteActiveEntry ? (
                <button
                  type="button"
                  onClick={deleteEntry}
                  disabled={isEditorPending}
                  className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-400 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Supprimer
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isEditorPending}
                className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#ddcfbb] bg-white px-3 py-2 text-sm font-semibold text-[#554a3f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEntry}
                disabled={isEditorPending}
                className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#b89056] bg-[#f6ead4] px-3 py-2 text-sm font-semibold text-[#5f4323] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <li className="w-full rounded-2xl bg-white/75 px-2.5 py-2 sm:px-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="touch-manipulation min-w-0 flex-1 truncate appearance-none [-webkit-appearance:none] border-0 bg-transparent p-0 text-left text-[0.98rem] font-semibold leading-tight text-[#3b3128] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.99]"
              onClick={(event) => onOpenFoodSummary?.(foodId, event.currentTarget)}
              aria-label={`Ouvrir le résumé de ${name}`}
              title="Résumé"
            >
              {name}
            </button>

          </div>

          <div
            role="group"
            aria-label={`Actions pour ${name}`}
            className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5"
          >
            {tastingCount === 0 ? (
              <>
                <button
                  type="button"
                  className={FIRST_BITE_BUTTON_CLASS}
                  onClick={() => openEditor(1)}
                  aria-label={`Marquer ${name} en première bouchée`}
                  title="Première bouchée"
                >
                  Première bouchée
                </button>
                <span aria-hidden="true" className={`${ACTION_BUTTON_BASE_CLASS} pointer-events-none opacity-0`}>
                  <span className={SLOT_VISUAL_BASE_CLASS} />
                </span>
              </>
            ) : (
              <div role="group" aria-label={`Dégustations pour ${name}`} className="flex items-center gap-1 sm:gap-1.5">
                {[1, 2, 3].map((slotValue) => {
                  const slot = slotValue as 1 | 2 | 3;
                  const tasting = tastingsBySlot.get(slot);
                  const isLockedNeutral = !tasting && nextCreatableSlot !== null && slot !== nextCreatableSlot;
                  const iconSrc = tasting
                    ? tasting.liked
                      ? "/images/reactions/smiley-ok.webp"
                      : "/images/reactions/smiley-ko.webp"
                    : "/images/reactions/smiley-neutral.webp";
                  const iconAlt = tasting ? (tasting.liked ? "Aimé" : "Pas aimé") : "À remplir";

                  const ariaLabel = tasting
                    ? `${name} - entrée ${slot} (${tasting.liked ? "aimé" : "pas aimé"} le ${formatDate(
                      tasting.tastedOn
                    )}). Modifier`
                    : `${name} - ajouter l'entrée ${slot}`;

                  return (
                    <button
                      key={slot}
                      type="button"
                      className={ACTION_BUTTON_BASE_CLASS}
                      aria-label={ariaLabel}
                      title={ariaLabel}
                      onClick={() => openSequentialEditor(slot)}
                    >
                      <span aria-hidden="true" className={`${SLOT_VISUAL_BASE_CLASS} ${isLockedNeutral ? "opacity-60" : ""}`}>
                        <Image
                          src={iconSrc}
                          alt={iconAlt}
                          width={36}
                          height={36}
                          className="h-full w-full object-contain"
                        />
                      </span>
                    </button>
                  );
                })}

                {canShowFinalPreference ? (
                  <button
                    type="button"
                    className={ACTION_BUTTON_BASE_CLASS}
                    onClick={() => onCycleFinalPreference(foodId)}
                    aria-pressed={finalPreference !== 0}
                    aria-label={`Préférence finale pour ${name}: ${currentFinalPreferenceLabel}. Appuyer pour passer à ${nextFinalPreferenceLabel}.`}
                    title={`Préférence finale: ${currentFinalPreferenceLabel} (prochain état: ${nextFinalPreferenceLabel})`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${SLOT_VISUAL_BASE_CLASS} ${getFinalPreferenceVisualClass(
                        finalPreference
                      )} ${isFinalPreferenceSaving ? "opacity-80" : ""}`}
                    >
                      <Image
                        src={getFinalPreferenceImageSrc(finalPreference)}
                        alt=""
                        aria-hidden="true"
                        width={36}
                        height={36}
                        className="h-full w-full object-contain"
                      />
                    </span>
                  </button>
                ) : (
                  <span aria-hidden="true" className={`${ACTION_BUTTON_BASE_CLASS} pointer-events-none opacity-0`}>
                    <span className={SLOT_VISUAL_BASE_CLASS} />
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              className={META_BUTTON_BASE_CLASS}
              aria-label={`Voir le résumé de ${name}`}
              title="Résumé"
              onClick={(event) => onOpenFoodSummary?.(foodId, event.currentTarget)}
            >
              <span aria-hidden="true" className={`${META_VISUAL_BASE_CLASS} border-[#b9ac9b]`}>
                <Pencil className="h-[17px] w-[17px]" />
              </span>
            </button>
          </div>
        </div>
      </li>

      {isMounted && editor ? createPortal(editor, document.body) : null}
    </>
  );
});

VegetableRow.displayName = "VegetableRow";
