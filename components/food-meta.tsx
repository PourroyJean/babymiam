"use client";

import { Pencil, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { setNoteAction } from "@/app/actions";

type FoodMetaProps = {
  foodId: number;
  foodName: string;
  note: string;
};

const META_BUTTON_BASE_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const META_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-[#fcfbf9]";

export function FoodMeta({ foodId, foodName, note }: FoodMetaProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [savedNote, setSavedNote] = useState(note);
  const [draftNote, setDraftNote] = useState(note);

  useEffect(() => {
    setSavedNote(note);
    if (!isOpen) {
      setDraftNote(note);
    }
  }, [note, isOpen]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function closePanel() {
    setDraftNote(savedNote);
    setIsOpen(false);
  }

  function saveNote() {
    const trimmedNote = draftNote.trim();
    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("note", trimmedNote);

    startTransition(async () => {
      await setNoteAction(formData);
      setSavedNote(trimmedNote);
      setDraftNote(trimmedNote);
      setIsOpen(false);
      router.refresh();
    });
  }

  const hasNote = savedNote.trim().length > 0;
  const noteVisualStyle = hasNote
    ? {
        backgroundColor: "var(--tone-pill, #f6ead4)",
        borderColor: "var(--tone-dot-border, #b89056)"
      }
    : undefined;

  const panel = isOpen ? (
    <div
      className="fixed inset-0 z-[2300] bg-[#1f1810]/45 sm:grid sm:place-items-center"
      role="presentation"
      onClick={closePanel}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`food-note-title-${foodId}`}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-[#e1d2bc] bg-[#fffdf8] p-4 shadow-2xl sm:relative sm:inset-auto sm:w-[min(100%,30rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 id={`food-note-title-${foodId}`} className="m-0 text-base font-bold text-[#3b3128]">
            {foodName}
          </h2>
          <button
            type="button"
            className="touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-[#bcae99] bg-white text-[#4c4136] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
            onClick={closePanel}
            aria-label="Fermer le panneau d'édition"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </header>

        <div className="grid gap-3">
          <label htmlFor={`note-${foodId}`} className="text-sm font-semibold text-[#554a3f]">
            Note
          </label>
          <textarea
            id={`note-${foodId}`}
            value={draftNote}
            onChange={(event) => setDraftNote(event.currentTarget.value)}
            placeholder="Écrire une note"
            rows={4}
            className="w-full rounded-xl border border-[#ddcfbb] bg-white px-3 py-2 text-base text-[#40362c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={closePanel}
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
        </div>

        {isPending ? <p className="mb-0 mt-3 text-sm font-semibold text-[#7b6648]">Enregistrement…</p> : null}
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={META_BUTTON_BASE_CLASS}
        aria-label={hasNote ? `Éditer la note de ${foodName}` : `Ajouter une note pour ${foodName}`}
        title={hasNote ? "Éditer la note" : "Ajouter une note"}
        onClick={() => setIsOpen(true)}
      >
        <span
          aria-hidden="true"
          className={`${META_VISUAL_BASE_CLASS} ${hasNote ? "" : "border-[#b9ac9b]"}`}
          style={noteVisualStyle}
        >
          <Pencil className="h-[17px] w-[17px]" />
        </span>
      </button>

      {isMounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
