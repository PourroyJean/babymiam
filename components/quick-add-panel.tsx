"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addQuickEntryAction } from "@/app/actions";
import { TastingEntryFormFields } from "@/components/tasting-entry-form-fields";
import {
  DEFAULT_REACTION_TYPE,
  type ReactionType,
  type TextureLevel
} from "@/lib/tasting-metadata";

type QuickAddFood = {
  id: number;
  name: string;
  categoryName: string;
  normalizedName: string;
  exposureCount: number;
};

type QuickAddPanelProps = {
  isOpen: boolean;
  foods: QuickAddFood[];
  onClose: () => void;
};

type TigerChoice = "ok" | "ko" | null;

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const FRENCH_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
const MAX_VISIBLE_RESULTS = 16;

function normalizeSearchValue(value: string) {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase().trim();
}

function getSearchRank(normalizedName: string, normalizedQuery: string) {
  if (normalizedName.startsWith(normalizedQuery)) return 0;
  if (normalizedName.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return Number.POSITIVE_INFINITY;
}

function getTodayLocalIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function QuickAddPanel({ isOpen, foods, onClose }: QuickAddPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState<number | null>(null);
  const [tastedOn, setTastedOn] = useState(getTodayLocalIsoDate());
  const [textureLevel, setTextureLevel] = useState<TextureLevel | null>(null);
  const [reactionType, setReactionType] = useState<ReactionType>(DEFAULT_REACTION_TYPE);
  const [showReactionLegend, setShowReactionLegend] = useState(false);
  const [tigerChoice, setTigerChoice] = useState<TigerChoice>(null);
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  function clearErrorMessage() {
    setErrorMessage("");
  }

  useEffect(() => {
    if (!isOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current) return;

    setQuery("");
    setSelectedFoodId(null);
    setTastedOn(getTodayLocalIsoDate());
    setTextureLevel(null);
    setReactionType(DEFAULT_REACTION_TYPE);
    setShowReactionLegend(false);
    setTigerChoice(null);
    setNote("");
    clearErrorMessage();
    wasOpenRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (selectedFoodId === null) return;
    if (foods.some((food) => food.id === selectedFoodId)) return;

    setSelectedFoodId(null);
    setQuery("");
  }, [foods, isOpen, selectedFoodId]);

  const normalizedQuery = useMemo(() => normalizeSearchValue(query), [query]);

  const searchResults = useMemo(() => {
    const sortedFoods = [...foods].sort((a, b) => FRENCH_COLLATOR.compare(a.name, b.name));

    if (!normalizedQuery) return sortedFoods.slice(0, MAX_VISIBLE_RESULTS);

    return sortedFoods
      .map((food) => ({
        food,
        rank: getSearchRank(food.normalizedName, normalizedQuery)
      }))
      .filter((entry) => Number.isFinite(entry.rank))
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return FRENCH_COLLATOR.compare(a.food.name, b.food.name);
      })
      .slice(0, MAX_VISIBLE_RESULTS)
      .map((entry) => entry.food);
  }, [foods, normalizedQuery]);

  const selectedFood = useMemo(
    () => foods.find((food) => food.id === selectedFoodId) ?? null,
    [foods, selectedFoodId]
  );

  const isSubmitDisabled = isPending || selectedFoodId === null || tigerChoice === null || !tastedOn;

  function resetForm() {
    setQuery("");
    setSelectedFoodId(null);
    setTastedOn(getTodayLocalIsoDate());
    setTextureLevel(null);
    setReactionType(DEFAULT_REACTION_TYPE);
    setShowReactionLegend(false);
    setTigerChoice(null);
    setNote("");
    clearErrorMessage();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled || selectedFoodId === null || tigerChoice === null) return;

    const formData = new FormData();
    formData.set("foodId", String(selectedFoodId));
    formData.set("tastedOn", tastedOn);
    formData.set("liked", tigerChoice === "ok" ? "true" : "false");
    formData.set("note", note);
    if (textureLevel !== null) {
      formData.set("textureLevel", String(textureLevel));
    }
    formData.set("reactionType", String(reactionType));

    startTransition(async () => {
      const result = await addQuickEntryAction(formData);
      if (!result.ok) {
        setErrorMessage(result.error || "Impossible d'ajouter cette entrée.");
        return;
      }

      resetForm();
      router.refresh();
      onClose();
    });
  }

  if (!isOpen) return null;

  return (
    <div className="quick-add-overlay" onClick={onClose} role="presentation">
      <section
        className="quick-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="quick-add-header">
          <h2 id="quick-add-title">Ajout rapide</h2>
          <button type="button" className="quick-add-close" onClick={onClose} aria-label="Fermer l'ajout rapide">
            Fermer
          </button>
        </header>

        <form className="quick-add-form" onSubmit={onSubmit}>
          <div className="quick-add-food-and-taste">
            <div className="quick-add-field">
              <label htmlFor="quick-add-food-search">Quel aliment ?</label>
              <input
                id="quick-add-food-search"
                ref={searchInputRef}
                type="text"
                className="quick-add-input"
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  clearErrorMessage();
                }}
                placeholder="Tape un aliment (ex: brocoli)"
                aria-label="Rechercher un aliment"
                autoComplete="off"
              />
              <div className="quick-add-results" role="listbox" aria-label="Résultats aliments">
                {searchResults.length > 0 ? (
                  <ul className="quick-add-results-list">
                    {searchResults.map((food) => {
                      const isSelected = food.id === selectedFoodId;
                      return (
                        <li key={`quick-add-food-${food.id}`}>
                          <button
                            type="button"
                            className={`quick-add-food-option ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedFoodId(food.id);
                              setQuery(food.name);
                              clearErrorMessage();
                            }}
                            aria-pressed={isSelected}
                          >
                            <span>{food.name}</span>
                            <small>{food.categoryName}</small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="quick-add-empty">Aucun aliment trouvé.</p>
                )}
              </div>
            {selectedFood ? (
              <p className="quick-add-selected">
                Sélectionné: <strong>{selectedFood.name}</strong> ({selectedFood.exposureCount}/3)
              </p>
            ) : null}
          </div>

          <div className="quick-add-right-column">
            <TastingEntryFormFields
              liked={tigerChoice}
              onLikedChange={(value) => {
                setTigerChoice(value);
                clearErrorMessage();
              }}
              tastedOn={tastedOn}
              onTastedOnChange={(value) => {
                setTastedOn(value);
                clearErrorMessage();
              }}
              textureLevel={textureLevel}
              onTextureLevelChange={(value) => {
                setTextureLevel(value);
                clearErrorMessage();
              }}
              reactionType={reactionType}
              onReactionTypeChange={(value) => {
                setReactionType(value);
                clearErrorMessage();
              }}
              note={note}
              onNoteChange={(value) => {
                setNote(value);
                clearErrorMessage();
              }}
              onInteraction={clearErrorMessage}
              reactionLegendVisible={showReactionLegend}
              onToggleReactionLegend={() => setShowReactionLegend((current) => !current)}
              idPrefix="quick-add"
            />
          </div>
          </div>

          {errorMessage ? <p className="quick-add-feedback quick-add-feedback-error">{errorMessage}</p> : null}

          <div className="quick-add-actions">
            <button type="button" className="quick-add-cancel" onClick={onClose} disabled={isPending}>
              Annuler
            </button>
            <button type="submit" className="quick-add-submit" disabled={isSubmitDisabled}>
              {isPending ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
