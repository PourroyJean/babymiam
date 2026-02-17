"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { TEXTURE_OPTIONS, getTextureOption, type TextureLevel } from "@/lib/tasting-metadata";

type TextureSegmentedControlProps = {
  value: TextureLevel | null;
  onChange: (value: TextureLevel | null) => void;
  disabled?: boolean;
  idPrefix?: string;
  allowClear?: boolean;
};

export function TextureSegmentedControl({
  value,
  onChange,
  disabled = false,
  idPrefix = "texture-segmented",
  allowClear = false
}: TextureSegmentedControlProps) {
  const [hintedLevel, setHintedLevel] = useState<TextureLevel | "none" | null>(null);

  const progressPercent = (() => {
    const normalizedValue = hintedLevel === "none" ? 0 : hintedLevel ?? value;
    if (normalizedValue === null) return 0;
    return (normalizedValue / TEXTURE_OPTIONS.length) * 100;
  })();

  const highlightedOption = useMemo(
    () => (hintedLevel === "none" ? null : getTextureOption(hintedLevel ?? value)),
    [hintedLevel, value]
  );

  const displayedHint = hintedLevel === "none" ? "Aucune texture" : null;

  return (
    <div className="texture-segmented-control">
      <div className="texture-segmented-main">
        <div className="texture-segmented-rail" aria-hidden="true">
          <div className="texture-segmented-progress" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="texture-segmented-steps" role="group" aria-label="Niveau de texture">
          {allowClear ? (
            <div className="texture-segmented-step">
              <button
                id={`${idPrefix}-none`}
                type="button"
                disabled={disabled}
                aria-pressed={value === null}
                className={`texture-segmented-btn ${value === null ? "is-current" : "is-inactive"}`}
                onClick={() => onChange(null)}
                onMouseEnter={() => setHintedLevel("none")}
                onMouseLeave={() => setHintedLevel((current) => (current === "none" ? null : current))}
                onFocus={() => setHintedLevel("none")}
                onBlur={() => setHintedLevel((current) => (current === "none" ? null : current))}
                title="Aucune texture"
              >
                <span className="texture-segmented-empty-label" aria-hidden="true">
                  ø
                </span>
              </button>

              <div className={`texture-segmented-tooltip ${hintedLevel === "none" ? "is-visible" : ""}`} role="tooltip">
                Aucune texture
              </div>
            </div>
          ) : null}

          {TEXTURE_OPTIONS.map((option) => {
            const isCurrent = value === option.level;
            const stateClass = isCurrent ? "is-current" : "is-inactive";

            return (
              <div key={option.level} className="texture-segmented-step">
                <button
                  id={`${idPrefix}-${option.level}`}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isCurrent}
                  className={`texture-segmented-btn ${stateClass}`}
                  onClick={() => onChange(option.level)}
                  onMouseEnter={() => setHintedLevel(option.level)}
                  onMouseLeave={() => setHintedLevel((current) => (current === option.level ? null : current))}
                  onFocus={() => setHintedLevel(option.level)}
                  onBlur={() => setHintedLevel((current) => (current === option.level ? null : current))}
                  title={option.description}
                >
                  <Image
                    src={option.iconSrc}
                    alt={option.shortName}
                    width={77}
                    height={77}
                    unoptimized
                    className="texture-segmented-icon"
                  />
                  <span className="texture-segmented-level-label">{option.level}</span>
                </button>

                <div
                  className={`texture-segmented-tooltip ${hintedLevel === option.level ? "is-visible" : ""}`}
                  role="tooltip"
                >
                  {option.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="texture-segmented-mobile-description" aria-live="polite">
        {value === null
          ? "Aucune texture"
          : highlightedOption
            ? highlightedOption.description
            : displayedHint ?? "Choisis une texture pour afficher sa description."}
      </p>
    </div>
  );
}
