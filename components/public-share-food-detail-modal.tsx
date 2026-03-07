"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getReactionOption, getTextureOption } from "@/lib/tasting-metadata";
import type { FinalPreferenceValue, FoodTastingEntry } from "@/lib/types";
import { formatDate, getFinalPreferenceImageSrc, getFinalPreferenceLabel, getTimelineTigerIcon } from "@/lib/ui-utils";

type PublicShareFoodDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  childFirstName?: string | null;
  foodName: string;
  categoryName: string;
  categoryToneClass: string;
  tastings: FoodTastingEntry[];
  tastingCount: number;
  finalPreference: FinalPreferenceValue;
  note: string;
};

export function PublicShareFoodDetailModal({
  isOpen,
  onClose,
  childFirstName = null,
  foodName,
  categoryName,
  categoryToneClass,
  tastings,
  tastingCount,
  finalPreference,
  note
}: PublicShareFoodDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = `public-share-food-detail-${foodName.replace(/\s+/g, "-").toLowerCase()}`;

  useEffect(() => {
    if (!isOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const childLabel = childFirstName?.trim() || "bébé";

  return createPortal(
    <div className="public-share-modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="public-share-food-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="public-share-food-modal-header">
          <div>
            <p className={`public-share-food-modal-category ${categoryToneClass}`}>{categoryName}</p>
            <h2 id={titleId}>{foodName}</h2>
            <p className="public-share-food-modal-subtitle">
              {childLabel} a enregistré {tastingCount}/3 dégustations.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="public-share-food-modal-close"
            onClick={onClose}
          >
            Fermer
          </button>
        </header>

        <section className="public-share-food-modal-summary">
          <article className="public-share-food-summary-card">
            <span>Préférence finale</span>
            <strong>{getFinalPreferenceLabel(finalPreference)}</strong>
            <Image
              src={getFinalPreferenceImageSrc(finalPreference)}
              alt=""
              aria-hidden="true"
              width={42}
              height={42}
            />
          </article>

          <article className="public-share-food-summary-card">
            <span>Note générale</span>
            <strong>{note.trim() || "Aucune note"}</strong>
          </article>
        </section>

        {tastings.length > 0 ? (
          <ol className="public-share-food-tasting-list">
            {tastings.map((tasting) => {
              const texture = getTextureOption(tasting.textureLevel);
              const reaction = getReactionOption(tasting.reactionType);

              return (
                <li key={`${foodName}-${tasting.slot}`} className="public-share-food-tasting-card">
                  <div className="public-share-food-tasting-head">
                    <div className="public-share-food-tasting-slot">
                      <span>Essai {tasting.slot}</span>
                      <strong>{formatDate(tasting.tastedOn)}</strong>
                    </div>

                    <Image
                      src={getTimelineTigerIcon(tasting.liked)}
                      alt=""
                      aria-hidden="true"
                      width={42}
                      height={42}
                    />
                  </div>

                  <dl className="public-share-food-tasting-meta">
                    <div>
                      <dt>Texture</dt>
                      <dd>{texture.shortName}</dd>
                    </div>
                    <div>
                      <dt>Réaction observée</dt>
                      <dd>{reaction?.label || "Aucun symptôme"}</dd>
                    </div>
                    <div>
                      <dt>Note</dt>
                      <dd>{tasting.note.trim() || "Aucune note"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="public-share-food-modal-empty">Aucune dégustation enregistrée pour cet aliment.</p>
        )}
      </section>
    </div>,
    document.body
  );
}
