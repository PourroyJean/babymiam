"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFirstTastedOnAction, setNoteAction } from "@/app/actions";

type FoodMetaProps = {
  foodId: number;
  firstTastedOn: string | null;
  note: string;
};

export function FoodMeta({ foodId, firstTastedOn, note }: FoodMetaProps) {
  const router = useRouter();
  const [isDatePending, startDateTransition] = useTransition();
  const [isNotePending, startNoteTransition] = useTransition();

  const [dateValue, setDateValue] = useState(firstTastedOn ?? "");
  const [savedNote, setSavedNote] = useState(note);
  const [draftNote, setDraftNote] = useState(note);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDateValue(firstTastedOn ?? "");
  }, [firstTastedOn]);

  useEffect(() => {
    setSavedNote(note);
    if (!isEditing) {
      setDraftNote(note);
    }
  }, [note, isEditing]);

  const hasNote = savedNote.trim().length > 0;

  function saveDate(nextDate: string) {
    const formData = new FormData();
    formData.set("foodId", String(foodId));
    formData.set("firstTastedOn", nextDate);

    startDateTransition(async () => {
      await setFirstTastedOnAction(formData);
      router.refresh();
    });
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
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="meta-controls">
      <input
        type="date"
        value={dateValue}
        aria-label="Date de première fois"
        onChange={(event) => {
          const nextDate = event.currentTarget.value;
          setDateValue(nextDate);
          saveDate(nextDate);
        }}
      />

      <div className="note-cell">
        <button
          type="button"
          className={`note-btn ${hasNote ? "has-note" : ""}`}
          aria-label={hasNote ? "Éditer la note" : "Ajouter une note"}
          title={hasNote ? "Éditer la note" : "Ajouter une note"}
          onClick={() => {
            setDraftNote(savedNote);
            setIsEditing(true);
          }}
          disabled={isNotePending}
        >
          ✎
        </button>

        {hasNote && !isEditing ? <div className="note-tooltip">{savedNote}</div> : null}

        {isEditing ? (
          <div className="note-editor">
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.currentTarget.value)}
              placeholder="Écrire une note"
              rows={3}
            />

            <div className="note-editor-actions">
              <button
                type="button"
                onClick={() => {
                  setDraftNote(savedNote);
                  setIsEditing(false);
                }}
                disabled={isNotePending}
              >
                Annuler
              </button>
              <button type="button" onClick={saveNote} disabled={isNotePending}>
                Enregistrer
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {(isDatePending || isNotePending) && <span className="saving-dot" aria-hidden="true" />}
    </div>
  );
}
