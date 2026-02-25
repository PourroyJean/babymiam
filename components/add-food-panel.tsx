"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createFoodAction } from "@/app/actions";
import { getRedirectUrlFromError } from "@/lib/ui-utils";

type AddFoodCategory = {
  id: number;
  name: string;
};

type AddFoodPanelProps = {
  isOpen: boolean;
  categories: AddFoodCategory[];
  onClose: () => void;
};

export function AddFoodPanel({ isOpen, categories, onClose }: AddFoodPanelProps) {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [foodName, setFoodName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [categories]
  );

  useEffect(() => {
    if (!isOpen) return;

    const defaultCategoryId = sortedCategories[0]?.id ?? null;
    setSelectedCategoryId((current) => current ?? defaultCategoryId);
  }, [isOpen, sortedCategories]);

  useEffect(() => {
    if (!isOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current) return;
    setSelectedCategoryId(null);
    setFoodName("");
    setErrorMessage("");
    wasOpenRef.current = false;
  }, [isOpen]);

  function clearErrorMessage() {
    setErrorMessage("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (selectedCategoryId === null) {
      setErrorMessage("Choisis une catégorie.");
      return;
    }

    const formData = new FormData();
    formData.set("categoryId", String(selectedCategoryId));
    formData.set("name", foodName);

    startTransition(async () => {
      try {
        const result = await createFoodAction(formData);
        if (!result.ok) {
          setErrorMessage(result.error || "Impossible d'ajouter cet aliment.");
          return;
        }

        setFoodName("");
        setErrorMessage("");
        onClose();
        router.refresh();
      } catch (error) {
        const redirectUrl = getRedirectUrlFromError(error);
        if (redirectUrl) {
          window.location.assign(redirectUrl);
          return;
        }

        setErrorMessage("Impossible d'ajouter cet aliment pour le moment.");
      }
    });
  }

  if (!isOpen) return null;

  return (
    <div
      className="add-food-overlay"
      onClick={() => {
        if (isPending) return;
        onClose();
      }}
      role="presentation"
    >
      <section
        className="add-food-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-food-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="add-food-header">
          <h2 id="add-food-title">Ajouter un aliment</h2>
          <button
            type="button"
            className="add-food-close"
            onClick={onClose}
            aria-label="Fermer l'ajout d'aliment"
            disabled={isPending}
          >
            Fermer
          </button>
        </header>

        <form className="add-food-form" onSubmit={onSubmit}>
          <label htmlFor="add-food-category">Catégorie</label>
          <select
            id="add-food-category"
            className="add-food-select"
            value={selectedCategoryId === null ? "" : String(selectedCategoryId)}
            onChange={(event) => {
              setSelectedCategoryId(event.currentTarget.value ? Number(event.currentTarget.value) : null);
              clearErrorMessage();
            }}
            disabled={isPending || sortedCategories.length === 0}
          >
            {sortedCategories.length === 0 ? <option value="">Aucune catégorie</option> : null}
            {sortedCategories.map((category) => (
              <option key={`add-food-category-${category.id}`} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <label htmlFor="add-food-name">Nom de l&apos;aliment</label>
          <input
            id="add-food-name"
            ref={nameInputRef}
            type="text"
            className="add-food-input"
            value={foodName}
            onChange={(event) => {
              setFoodName(event.currentTarget.value);
              clearErrorMessage();
            }}
            placeholder="Ex: Patate douce"
            disabled={isPending}
          />

          <div className="add-food-actions">
            <button type="button" onClick={onClose} disabled={isPending} className="add-food-cancel">
              Annuler
            </button>
            <button type="submit" disabled={isPending || sortedCategories.length === 0} className="add-food-submit">
              Ajouter
            </button>
          </div>

          {errorMessage ? <p className="add-food-error">{errorMessage}</p> : null}
        </form>
      </section>
    </div>
  );
}
