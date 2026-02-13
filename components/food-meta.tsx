"use client";

import { Calendar, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { setFirstTastedOnAction, setNoteAction } from "@/app/actions";

type FoodMetaProps = {
  foodId: number;
  foodName: string;
  firstTastedOn: string | null;
  note: string;
};

type EditorMode = "date" | "note" | null;

const META_BUTTON_BASE_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const META_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-[#fcfbf9]";

function formatDate(value: string) {
  if (!value) return "Aucune date enregistrée";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function FoodMeta({ foodId, foodName, firstTastedOn, note }: FoodMetaProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isDatePending, startDateTransition] = useTransition();
  const [isNotePending, startNoteTransition] = useTransition();
  const [editorMode, setEditorMode] = useState<EditorMode>(null);

  const [dateValue, setDateValue] = useState(firstTastedOn ?? "");
  const [savedNote, setSavedNote] = useState(note);
  const [draftNote, setDraftNote] = useState(note);

  useEffect(() => {
    setDateValue(firstTastedOn ?? "");
  }, [firstTastedOn]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSavedNote(note);
    if (editorMode !== "note") {
      setDraftNote(note);
    }
  }, [note, editorMode]);

  useEffect(() => {
    if (!editorMode) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditorMode(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorMode]);

  useEffect(() => {
    if (!editorMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editorMode]);

  const hasNote = savedNote.trim().length > 0;
  const hasDate = dateValue.length > 0;
  const formattedDate = useMemo(() => formatDate(dateValue), [dateValue]);
  const isOpen = editorMode !== null;

  function saveDate(nextDate: string) {
    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("firstTastedOn", nextDate);

    startDateTransition(async () => {
      await setFirstTastedOnAction(formData);
      router.refresh();
    });
  }

  function clearDate() {
    setDateValue("");
    saveDate("");
  }

  function saveNote() {
    const trimmedNote = draftNote.trim();

    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("note", trimmedNote);

    startNoteTransition(async () => {
      await setNoteAction(formData);
      setSavedNote(trimmedNote);
      setDraftNote(trimmedNote);
      setEditorMode(null);
      router.refresh();
    });
  }

  const panel = isOpen ? (
    <div
      className="fixed inset-0 z-[2300] bg-[#1f1810]/45 sm:grid sm:place-items-center"
      role="presentation"
      onClick={() => setEditorMode(null)}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`food-meta-title-${foodId}`}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-[#e1d2bc] bg-[#fffdf8] p-4 shadow-2xl sm:relative sm:inset-auto sm:w-[min(100%,30rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 id={`food-meta-title-${foodId}`} className="m-0 text-base font-bold text-[#3b3128]">
            {foodName}
          </h2>
          <button
            type="button"
            className="touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-[#bcae99] bg-white text-[#4c4136] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
            onClick={() => setEditorMode(null)}
            aria-label="Fermer le panneau d'édition"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setEditorMode("date")}
            aria-pressed={editorMode === "date"}
            className={`touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 ${
              editorMode === "date"
                ? "border-[#b89056] bg-[#f6ead4] text-[#5f4323]"
                : "border-[#ddcfbb] bg-white text-[#5c5144]"
            }`}
          >
            Date
          </button>
          <button
            type="button"
            onClick={() => setEditorMode("note")}
            aria-pressed={editorMode === "note"}
            className={`touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 ${
              editorMode === "note"
                ? "border-[#b89056] bg-[#f6ead4] text-[#5f4323]"
                : "border-[#ddcfbb] bg-white text-[#5c5144]"
            }`}
          >
            Note
          </button>
        </div>

        {editorMode === "date" ? (
          <div className="grid gap-3">
            <label htmlFor={`first-tasted-${foodId}`} className="text-sm font-semibold text-[#554a3f]">
              Date de première fois
            </label>
            <input
              id={`first-tasted-${foodId}`}
              type="date"
              value={dateValue}
              className="h-12 w-full rounded-xl border border-[#ddcfbb] bg-white px-3 text-base text-[#40362c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2"
              onChange={(event) => {
                const nextDate = event.currentTarget.value;
                setDateValue(nextDate);
                saveDate(nextDate);
              }}
            />
            <p className="m-0 text-sm text-[#6f6354]">{formattedDate}</p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={clearDate}
                disabled={isDatePending || !hasDate}
                className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#ddcfbb] bg-white px-3 py-2 text-sm font-semibold text-[#554a3f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => setEditorMode(null)}
                className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#b89056] bg-[#f6ead4] px-3 py-2 text-sm font-semibold text-[#5f4323]"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
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
                onClick={() => {
                  setDraftNote(savedNote);
                  setEditorMode(null);
                }}
                disabled={isNotePending}
                className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#ddcfbb] bg-white px-3 py-2 text-sm font-semibold text-[#554a3f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={isNotePending}
                className="touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#b89056] bg-[#f6ead4] px-3 py-2 text-sm font-semibold text-[#5f4323] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {isDatePending || isNotePending ? (
          <p className="mb-0 mt-3 text-sm font-semibold text-[#7b6648]">Enregistrement…</p>
        ) : null}
      </section>
    </div>
  ) : null;

  return (
    <>
      <div className="inline-flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          className={META_BUTTON_BASE_CLASS}
          aria-label={hasDate ? `Voir la date de ${foodName}` : `Ajouter une date pour ${foodName}`}
          title={formattedDate}
          onClick={() => setEditorMode("date")}
        >
          <span
            aria-hidden="true"
            className={`${META_VISUAL_BASE_CLASS} ${hasDate ? "border-[#d5b07f] bg-[#fff1dc] text-[#80572e]" : "border-[#b9ac9b] text-[#8d867d]"}`}
          >
            <Calendar className="h-[18px] w-[18px]" />
          </span>
        </button>

        <button
          type="button"
          className={META_BUTTON_BASE_CLASS}
          aria-label={hasNote ? `Éditer la note de ${foodName}` : `Ajouter une note pour ${foodName}`}
          title={hasNote ? savedNote : "Aucune note"}
          onClick={() => {
            setDraftNote(savedNote);
            setEditorMode("note");
          }}
          disabled={isNotePending}
        >
          <span
            aria-hidden="true"
            className={`${META_VISUAL_BASE_CLASS} ${hasNote ? "border-[#e2b06f] bg-[#ffe8ca] text-[#d37b2b]" : "border-[#b9ac9b] text-[#8e8a84]"}`}
          >
            <Pencil className="h-[18px] w-[18px]" />
          </span>
        </button>
      </div>

      {isMounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
