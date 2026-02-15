"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addQuickEntryAction } from "@/app/actions";

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
  const [tigerChoice, setTigerChoice] = useState<TigerChoice>(null);
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

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
    setTigerChoice(null);
    setNote("");
    setErrorMessage("");
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
    setTigerChoice(null);
    setNote("");
    setErrorMessage("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled || selectedFoodId === null || tigerChoice === null) return;

    const formData = new FormData();
    formData.set("foodId", String(selectedFoodId));
    formData.set("tastedOn", tastedOn);
    formData.set("liked", tigerChoice === "ok" ? "true" : "false");
    formData.set("note", note);

    startTransition(async () => {
      const result = await addQuickEntryAction(formData);
      if (!result.ok) {
        setErrorMessage(result.error || "Impossible d'ajouter cette entrée.");
        return;
      }

      resetForm();
      router.refresh();
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
                setErrorMessage("");
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
                            setErrorMessage("");
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
            ) : (
              <p className="quick-add-selected">Sélectionne un aliment existant.</p>
            )}
          </div>

          <div className="quick-add-field">
            <label htmlFor="quick-add-date">Quand ?</label>
            <input
              id="quick-add-date"
              type="date"
              className="quick-add-input"
              value={tastedOn}
              onChange={(event) => {
                setTastedOn(event.currentTarget.value);
                setErrorMessage("");
              }}
              aria-label="Date"
            />
          </div>

          <div className="quick-add-field">
            <p className="quick-add-label">Comment c&apos;était ?</p>
            <div className="quick-add-tiger-choice" role="group" aria-label="Choix tigre">
              <button
                type="button"
                className={`quick-add-tiger-btn ${tigerChoice === "ok" ? "active-ok" : ""}`}
                onClick={() => {
                  setTigerChoice("ok");
                  setErrorMessage("");
                }}
                aria-pressed={tigerChoice === "ok"}
                aria-label="Tigre OK"
              >
                <img
                  src="/smiley_ok.png"
                  alt="Tigre OK"
                  className="quick-add-tiger-img"
                />
              </button>
              <button
                type="button"
                className={`quick-add-tiger-btn ${tigerChoice === "ko" ? "active-ko" : ""}`}
                onClick={() => {
                  setTigerChoice("ko");
                  setErrorMessage("");
                }}
                aria-pressed={tigerChoice === "ko"}
                aria-label="Tigre KO"
              >
                <img
                  src="/smiley_ko.png"
                  alt="Tigre KO"
                  className="quick-add-tiger-img"
                />
              </button>
            </div>
          </div>

          <div className="quick-add-field">
            <label htmlFor="quick-add-note">Note</label>
            <textarea
              id="quick-add-note"
              className="quick-add-input quick-add-note"
              rows={3}
              value={note}
              onChange={(event) => {
                setNote(event.currentTarget.value);
                setErrorMessage("");
              }}
              placeholder="Ajouter une note (optionnel)"
              aria-label="Note"
            />
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
