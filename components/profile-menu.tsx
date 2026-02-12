"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveChildProfileAction } from "@/app/actions";
import type { ChildProfile } from "@/lib/types";

type ProfileMenuProps = {
  initialProfile: ChildProfile | null;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ProfileMenu({ initialProfile }: ProfileMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  const initialFirstName = initialProfile?.firstName ?? "";
  const initialBirthDate = initialProfile?.birthDate ?? "";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);

  useEffect(() => {
    if (!isOpen) {
      setFirstName(initialFirstName);
      setBirthDate(initialBirthDate);
      setErrorMessage("");
    }
  }, [initialFirstName, initialBirthDate, isOpen]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDirty = firstName.trim() !== initialFirstName || birthDate !== initialBirthDate;

  const isValid = useMemo(() => {
    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) return false;
    if (!isValidIsoDate(birthDate)) return false;
    return birthDate <= getTodayIsoDate();
  }, [firstName, birthDate]);

  function onClose() {
    setIsOpen(false);
  }

  function onSave() {
    if (!isDirty || !isValid) return;

    const formData = new FormData();
    formData.set("firstName", firstName.trim());
    formData.set("birthDate", birthDate);

    startTransition(async () => {
      const result = await saveChildProfileAction(formData);
      if (!result.ok) {
        setErrorMessage(result.error || "Impossible d'enregistrer le profil.");
        return;
      }

      setErrorMessage("");
      setIsOpen(false);
      router.refresh();
    });
  }

  const modal = isOpen ? (
    <div className="profile-modal-overlay" onClick={onClose} role="presentation">
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-modal-title">Profil enfant</h2>

        <div className="profile-form">
          <label htmlFor="child-first-name">Prénom</label>
          <input
            id="child-first-name"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.currentTarget.value)}
            placeholder="Ex: Louise"
            autoComplete="off"
          />

          <label htmlFor="child-birth-date">Date de naissance</label>
          <input
            id="child-birth-date"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.currentTarget.value)}
          />
        </div>

        {errorMessage ? <p className="profile-error">{errorMessage}</p> : null}

        <div className="profile-actions">
          <button type="button" onClick={onClose} disabled={isPending}>
            Annuler
          </button>
          <button type="button" onClick={onSave} disabled={!isDirty || !isValid || isPending}>
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <div className="profile-menu">
      <button type="button" className="profile-btn" onClick={() => setIsOpen(true)}>
        Profil
      </button>
      {isMounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
