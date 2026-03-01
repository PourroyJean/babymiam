"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteTastingEntryAction, saveTastingEntryAction } from "@/app/actions";
import { CheckCircle } from "lucide-react";
import { getClientTimezoneOffsetMinutes } from "@/lib/date-utils";
import type { FoodTastingEntry } from "@/lib/types";
import { TastingEntryFormFields, type TigerLikedChoice } from "@/components/tasting-entry-form-fields";
import {
  DEFAULT_TEXTURE_LEVEL,
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
  themeClass?: string;
  buttonThemeClass?: string;
};

const ACTION_BUTTON_BASE_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-[52px] w-[52px] min-h-[52px] min-w-[52px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const FIRST_BITE_BUTTON_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-[48px] min-h-[48px] w-full min-w-0 items-center justify-center gap-2 sm:gap-2.5 rounded-[1.25rem] border border-black bg-[#c3e3cf] px-1 sm:px-5 py-2.5 text-[#153e21] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const SLOT_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-full border-[2.5px] border-white bg-[#fcfbf9] p-0";

const ROW_CONTAINER_CLASS =
  "mb-1 sm:mb-2 w-full rounded-2xl bg-white px-2.5 py-1.5 sm:py-2.5 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.07)] sm:px-3";

const ROW_GRID_CLASS =
  "grid min-h-[52px] items-center gap-2 sm:gap-3 grid-cols-[40%_minmax(0,60%)]";

const FOOD_NAME_CONTAINER_CLASS =
  "flex h-full min-w-0 items-stretch gap-2 py-1";

const FOOD_NAME_BUTTON_CLASS =
  "touch-manipulation flex h-full items-center min-w-0 flex-1 appearance-none [-webkit-appearance:none] border-0 bg-transparent p-0 text-left text-[0.95rem] sm:text-[0.98rem] font-semibold leading-tight text-[#3b3128] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.99]";

const ACTIONS_CONTAINER_CLASS =
  "flex flex-nowrap items-center justify-end gap-1.5 w-full";

const TASTING_SLOTS_CONTAINER_CLASS =
  "flex items-center justify-between w-full pt-1";

export const VegetableRow = memo(function VegetableRow({
  foodId,
  name,
  tastings,
  tastingCount,
  finalPreference,
  onCycleFinalPreference,
  onOpenFoodSummary,
  childFirstName = null,
  isFinalPreferenceSaving = false,
  themeClass,
  buttonThemeClass
}: VegetableRowProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSlot, setEditorSlot] = useState<1 | 2 | 3 | null>(null);
  const [editorLiked, setEditorLiked] = useState<TigerLikedChoice | null>(null);
  const [editorDate, setEditorDate] = useState("");
  const [editorTextureLevel, setEditorTextureLevel] = useState<TextureLevel>(DEFAULT_TEXTURE_LEVEL);
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
    setEditorTextureLevel(DEFAULT_TEXTURE_LEVEL);
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

  function getChoiceFromLiked(liked: boolean | null): TigerLikedChoice {
    if (liked === true) return "ok";
    if (liked === false) return "ko";
    return "indecis";
  }

  function getFilledSlotIcon(liked: boolean | null) {
    if (liked === true) return "/images/reactions/smiley-ok.webp";
    if (liked === false) return "/images/reactions/smiley-ko.webp";
    return "/images/reactions/smiley-indecis.webp";
  }

  function getFilledSlotLabel(liked: boolean | null) {
    if (liked === true) return "aimé";
    if (liked === false) return "pas aimé";
    return "indécis";
  }

  function openEditor(slot: 1 | 2 | 3) {
    const existing = tastingsBySlot.get(slot);

    setEditorSlot(slot);
    setEditorLiked(existing ? getChoiceFromLiked(existing.liked) : null);
    setEditorDate(existing?.tastedOn || getTodayIsoDate());
    setEditorTextureLevel(existing?.textureLevel ?? DEFAULT_TEXTURE_LEVEL);
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
      setEditorError(`Choisis une réaction pour ${childLabel}: OK, Indécis ou KO.`);
      return;
    }

    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("slot", String(editorSlot));
    formData.set("liked", editorLiked);
    formData.set("tastedOn", editorDate || getTodayIsoDate());
    formData.set("note", editorNote.trim());
    formData.set("tzOffsetMinutes", String(getClientTimezoneOffsetMinutes()));
    formData.set("textureLevel", String(editorTextureLevel));
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
              liked={editorLiked}
              onLikedChange={setEditorLiked}
              tigerAriaLabels={{ ok: "Oui", indecis: "Indécis", ko: "Non" }}
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
      <li className={ROW_CONTAINER_CLASS}>
        <div className={ROW_GRID_CLASS}>
          <div className={FOOD_NAME_CONTAINER_CLASS}>
            <button
              type="button"
              className={FOOD_NAME_BUTTON_CLASS}
              onClick={(event) => onOpenFoodSummary?.(foodId, event.currentTarget)}
              aria-label={`Ouvrir le résumé de ${name}`}
              title="Résumé"
            >
              <span className="truncate w-full block">{name}</span>
            </button>
          </div>

          <div
            role="group"
            aria-label={`Actions pour ${name}`}
            className={ACTIONS_CONTAINER_CLASS}
          >
            {tastingCount === 0 ? (
              <button
                type="button"
                className={`${FIRST_BITE_BUTTON_CLASS} ${buttonThemeClass}`}
                style={{ backgroundColor: 'var(--tone-surface)' }}
                onClick={() => openEditor(1)}
                aria-label={`Marquer ${name} en première bouchée`}
                title="Première bouchée"
              >
                <CheckCircle className="h-5 w-5 sm:h-5 sm:w-5 opacity-90 shrink-0 text-black" strokeWidth={2.5} />
                <div className="flex flex-col items-start leading-[1.2] min-w-0 overflow-hidden w-full gap-0.5">
                  <span className="text-[0.62rem] sm:text-[0.6rem] font-bold tracking-[0.05em] sm:tracking-[0.08em] opacity-80 uppercase truncate w-full text-left">
                    Enregistrer
                  </span>
                  <span className="text-[0.75rem] sm:text-[0.85rem] font-bold tracking-tight uppercase truncate w-full text-left">
                    PREMIÈRE BOUCHÉE
                  </span>
                </div>
              </button>
            ) : (
              <div role="group" aria-label={`Dégustations pour ${name}`} className={TASTING_SLOTS_CONTAINER_CLASS}>
                {[1, 2, 3].map((slotValue) => {
                  const slot = slotValue as 1 | 2 | 3;
                  const tasting = tastingsBySlot.get(slot);
                  const isLockedNeutral = !tasting && nextCreatableSlot !== null && slot !== nextCreatableSlot;
                  const iconSrc = tasting
                    ? getFilledSlotIcon(tasting.liked)
                    : "/images/reactions/smiley-neutral.webp";
                  const iconAlt = tasting ? getFilledSlotLabel(tasting.liked) : "À remplir";

                  const ariaLabel = tasting
                    ? `${name} - entrée ${slot} (${getFilledSlotLabel(tasting.liked)} le ${formatDate(
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
                          width={42}
                          height={42}
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
                        width={42}
                        height={42}
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
          </div>
        </div>
      </li >

      {isMounted && editor ? createPortal(editor, document.body) : null
      }
    </>
  );
});

VegetableRow.displayName = "VegetableRow";
