"use client";

import Image from "next/image";
import { TextureSegmentedControl } from "@/components/texture-segmented-control";
import {
  REACTION_OPTIONS,
  type ReactionType,
  type TextureLevel
} from "@/lib/tasting-metadata";

export type TigerLikedChoice = "ok" | "ko";

type TastingEntryFormFieldsProps = {
  liked: TigerLikedChoice | null;
  onLikedChange: (liked: TigerLikedChoice) => void;
  tigerAriaLabels?: {
    ok: string;
    ko: string;
  };
  likedQuestionLabel?: string;
  likedGroupAriaLabel?: string;
  tastedOn: string;
  onTastedOnChange: (value: string) => void;
  tastedOnLabel?: string;
  tastedOnAriaLabel?: string;
  textureLevel: TextureLevel | null;
  onTextureLevelChange: (value: TextureLevel | null) => void;
  reactionType: ReactionType;
  onReactionTypeChange: (value: ReactionType) => void;
  note: string;
  onNoteChange: (value: string) => void;
  onInteraction?: () => void;
  reactionLegendVisible?: boolean;
  onToggleReactionLegend?: () => void;
  idPrefix?: string;
  disabled?: boolean;
};

const TIGER_CHOICES: Array<{
  value: TigerLikedChoice;
  image: string;
  alt: string;
  screenReaderText: string;
}> = [
  {
    value: "ok",
    image: "/images/reactions/smiley-ok.webp",
    alt: "Tigre OK",
    screenReaderText: "Oui"
  },
  {
    value: "ko",
    image: "/images/reactions/smiley-ko.webp",
    alt: "Tigre KO",
    screenReaderText: "Non"
  }
];

export function TastingEntryFormFields({
  liked,
  onLikedChange,
  tigerAriaLabels = {
    ok: "Tigre OK",
    ko: "Tigre KO"
  },
  likedQuestionLabel = "Comment c'était ?",
  likedGroupAriaLabel = "Choix tigre",
  tastedOn,
  onTastedOnChange,
  tastedOnLabel = "Date de dégustation",
  tastedOnAriaLabel = "Date de dégustation",
  textureLevel,
  onTextureLevelChange,
  reactionType,
  onReactionTypeChange,
  note,
  onNoteChange,
  onInteraction,
  disabled,
  reactionLegendVisible = false,
  onToggleReactionLegend,
  idPrefix = "quick-add"
}: TastingEntryFormFieldsProps) {
  const reactionInputId = `${idPrefix}-reaction`;
  const reactionLegendId = `${idPrefix}-reaction-legend`;
  const labelSuffix = onToggleReactionLegend ? " (optionnel)" : "";

  function reportInteraction() {
    onInteraction?.();
  }

  return (
    <>
      <div className="quick-add-field">
        <p className="quick-add-label">{likedQuestionLabel}</p>
        <div className="quick-add-tiger-choice" role="group" aria-label={likedGroupAriaLabel}>
          {TIGER_CHOICES.map((choice) => {
            const isSelected = liked === choice.value;
            const isOtherSelected = liked !== null && !isSelected;
            return (
              <button
                key={choice.value}
                type="button"
                aria-label={choice.value === "ok" ? tigerAriaLabels.ok : tigerAriaLabels.ko}
                aria-pressed={isSelected}
                className={`touch-manipulation inline-flex appearance-none border-0 bg-transparent p-0 min-h-[60px] items-center justify-center transition-all ${
                  isSelected ? "scale-110" : isOtherSelected ? "scale-95" : "scale-100"
                }`}
                onClick={() => {
                  onLikedChange(choice.value);
                  reportInteraction();
                }}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-[100px] w-[100px] items-center justify-center transition-all ${
                    isSelected || liked === null ? "opacity-100" : "opacity-85 grayscale"
                  }`}
                >
                  <Image
                    src={choice.image}
                    alt={choice.alt}
                    width={100}
                    height={100}
                    className={`h-24 w-24 object-contain transition-all ${isSelected ? "h-[100px] w-[100px]" : ""}`}
                  />
                </span>
                <span className="quick-add-sr-only">{choice.screenReaderText}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="quick-add-field">
        <label htmlFor={`${idPrefix}-date`}>{tastedOnLabel}</label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          className="quick-add-input"
          value={tastedOn}
          onChange={(event) => {
            onTastedOnChange(event.currentTarget.value);
            reportInteraction();
          }}
          disabled={Boolean(disabled)}
          aria-label={tastedOnAriaLabel}
        />
      </div>

      <div className="quick-add-field quick-add-texture-block">
        <TextureSegmentedControl
          value={textureLevel}
          onChange={(value) => {
            onTextureLevelChange(value);
            reportInteraction();
          }}
          disabled={Boolean(disabled)}
          idPrefix={idPrefix}
          allowClear
        />
      </div>

      <div className="quick-add-field">
        <div className="quick-add-label-row">
          <label htmlFor={reactionInputId}>Réaction observée{labelSuffix}</label>
          {onToggleReactionLegend ? (
            <button
              type="button"
              className="quick-add-reaction-help-btn"
              onClick={onToggleReactionLegend}
              aria-expanded={reactionLegendVisible}
              aria-controls={reactionLegendId}
              aria-label="Voir les légendes des réactions"
              title="Voir les légendes des réactions"
            >
              i
            </button>
          ) : null}
        </div>
        <select
          id={reactionInputId}
          className="quick-add-input"
          value={String(reactionType)}
          onChange={(event) => {
            onReactionTypeChange(Number(event.currentTarget.value) as ReactionType);
            reportInteraction();
          }}
          disabled={Boolean(disabled)}
          aria-label="Réaction observée"
        >
          {REACTION_OPTIONS.map((option) => (
            <option key={option.type} value={option.type}>
              {option.emoji} {option.label}
            </option>
          ))}
        </select>
        {reactionLegendVisible && onToggleReactionLegend ? (
          <div id={reactionLegendId} className="quick-add-reaction-legend">
            {REACTION_OPTIONS.map((option) => (
              <p key={option.type} className="quick-add-reaction-legend-item">
                <span>{option.emoji}</span>
                <span>
                  {option.label}: {option.description}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="quick-add-field">
        <label htmlFor={`${idPrefix}-note`}>Note du test</label>
        <textarea
          id={`${idPrefix}-note`}
          className="quick-add-input quick-add-note"
          rows={3}
          value={note}
          onChange={(event) => {
            onNoteChange(event.currentTarget.value);
            reportInteraction();
          }}
          placeholder="Ajouter une note de test (optionnel)"
          disabled={Boolean(disabled)}
          aria-label="Note du test"
        />
      </div>
    </>
  );
}
