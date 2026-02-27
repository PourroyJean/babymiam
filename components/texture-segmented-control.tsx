"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  TEXTURE_OPTIONS,
  getTextureOption,
  type TextureLevel
} from "@/lib/tasting-metadata";

type TextureSegmentedControlProps = {
  value: TextureLevel;
  onChange: (value: TextureLevel) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function TextureSegmentedControl({
  value,
  onChange,
  disabled = false,
  idPrefix = "texture-segmented"
}: TextureSegmentedControlProps) {
  const [hintedLevel, setHintedLevel] = useState<TextureLevel | null>(null);

  const progressPercent = (() => {
    const normalizedValue = hintedLevel ?? value;
    return (normalizedValue / TEXTURE_OPTIONS.length) * 100;
  })();

  const highlightedOption = useMemo(() => getTextureOption(hintedLevel ?? value), [hintedLevel, value]);

  return (
    <div className="texture-segmented-control">
      <div className="texture-segmented-main">
        <div className="texture-segmented-rail" aria-hidden="true">
          <div className="texture-segmented-progress" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="texture-segmented-steps" role="group" aria-label="Niveau de texture">
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
        {highlightedOption.description}
      </p>
    </div>
  );
}
