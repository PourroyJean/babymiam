import type { TextureLevel } from "@/lib/tasting-metadata";
import type { FoodTimelineEntry, TextureCoachSnapshot, TextureCoachStatus } from "@/lib/types";

const RECENT_TEXTURE_ENTRY_LIMIT = 12;
const FRENCH_COLLATOR = new Intl.Collator("fr", { sensitivity: "base" });
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TEXTURE_LABEL_BY_LEVEL: Record<TextureLevel, string> = {
  1: "Lisse",
  2: "Ecrase",
  3: "Fondant",
  4: "A macher"
};

type TextureTarget = {
  min: TextureLevel;
  max: TextureLevel;
  label: string;
};

type FoodTextureStats = {
  foodName: string;
  maxLikedTexture: TextureLevel | null;
  maxTriedTexture: TextureLevel | null;
  lastLikedTimestamp: number;
};

function parseIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed;
}

function getTimelineEntryTimestamp(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) return 0;
  return parsed.getTime();
}

function clampTextureLevel(value: number): TextureLevel {
  if (value <= 1) return 1;
  if (value >= 4) return 4;
  return value as TextureLevel;
}

function formatTextureLevelLabel(level: TextureLevel | null) {
  if (level === null) return "Non renseigne";
  return `Niveau ${level} (${TEXTURE_LABEL_BY_LEVEL[level]})`;
}

function getAgeInMonths(birthDate: Date, now: Date) {
  let months = (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12;
  months += now.getUTCMonth() - birthDate.getUTCMonth();

  if (now.getUTCDate() < birthDate.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function getTextureTargetByAgeMonths(ageMonths: number): TextureTarget {
  if (ageMonths < 6) {
    return { min: 1, max: 1, label: "Niveau 1 (lisse)" };
  }

  if (ageMonths < 8) {
    return { min: 1, max: 2, label: "Niveaux 1-2 (lisse -> ecrase)" };
  }

  if (ageMonths < 10) {
    return { min: 2, max: 3, label: "Niveaux 2-3 (ecrase -> fondant)" };
  }

  if (ageMonths < 12) {
    return { min: 3, max: 4, label: "Niveaux 3-4 (fondant -> a macher)" };
  }

  return { min: 4, max: 4, label: "Niveau 4 (a macher / morceaux)" };
}

function getStatus(targetMin: TextureLevel, observedTextureLevel: TextureLevel | null): TextureCoachStatus {
  if (observedTextureLevel === null) return "no_data";
  const gap = targetMin - observedTextureLevel;
  if (gap <= 0) return "aligned";
  if (gap === 1) return "watch";
  return "behind";
}

function getStatusLabel(status: TextureCoachStatus) {
  if (status === "aligned") return "Dans la cible";
  if (status === "watch") return "A renforcer";
  if (status === "behind") return "Priorite texture";
  return "A activer";
}

function getStatusDescription(
  status: TextureCoachStatus,
  ageMonths: number,
  targetLabel: string,
  observedLabel: string
) {
  if (status === "no_data") {
    return "Le coach a besoin de textures renseignees pour produire des conseils fiables.";
  }

  if (status === "aligned") {
    return `A ${ageMonths} mois, ${observedLabel.toLowerCase()} reste coherent avec la cible ${targetLabel.toLowerCase()}.`;
  }

  if (status === "watch") {
    return `Leger decalage: la cible a ${ageMonths} mois est ${targetLabel.toLowerCase()}, mais le niveau observe est ${observedLabel.toLowerCase()}.`;
  }

  return `Decalage important: la cible a ${ageMonths} mois est ${targetLabel.toLowerCase()}, alors que le niveau observe est ${observedLabel.toLowerCase()}.`;
}

function resolveGoalTextureLevel(targetMin: TextureLevel, observedTextureLevel: TextureLevel | null): TextureLevel {
  if (observedTextureLevel === null) return targetMin;
  if (observedTextureLevel < targetMin) return targetMin;
  return clampTextureLevel(observedTextureLevel + 1);
}

function getActionLabel(status: TextureCoachStatus, goalTextureLevel: TextureLevel) {
  if (status === "no_data") {
    return "Renseigne la texture sur 3 repas pour debloquer un plan personnalise.";
  }

  if (status === "aligned") {
    return `Cap utile: maintenir 2 essais par semaine au niveau ${goalTextureLevel} pour consolider l'acquisition.`;
  }

  if (status === "watch") {
    return `Plan court: ajouter 2 essais par semaine au niveau ${goalTextureLevel} avec des aliments deja acceptes.`;
  }

  return `Priorite pratique: remonter progressivement vers le niveau ${goalTextureLevel} pour eviter le blocage sur le lisse.`;
}

function getSuggestedFoods(timelineEntries: FoodTimelineEntry[], goalTextureLevel: TextureLevel) {
  const statsByFoodId = new Map<number, FoodTextureStats>();

  for (const entry of timelineEntries) {
    if (entry.textureLevel === null) continue;

    const existing = statsByFoodId.get(entry.foodId) ?? {
      foodName: entry.foodName,
      maxLikedTexture: null,
      maxTriedTexture: null,
      lastLikedTimestamp: 0
    };

    const currentTexture = entry.textureLevel;
    const maxTriedTexture = existing.maxTriedTexture ?? 0;
    existing.maxTriedTexture = clampTextureLevel(Math.max(maxTriedTexture, currentTexture));

    if (entry.liked) {
      const maxLikedTexture = existing.maxLikedTexture ?? 0;
      existing.maxLikedTexture = clampTextureLevel(Math.max(maxLikedTexture, currentTexture));
      existing.lastLikedTimestamp = Math.max(
        existing.lastLikedTimestamp,
        getTimelineEntryTimestamp(entry.tastedOn) + entry.slot
      );
    }

    statsByFoodId.set(entry.foodId, existing);
  }

  return [...statsByFoodId.values()]
    .filter((stats) => {
      if (stats.maxLikedTexture === null) return false;
      if (stats.maxLikedTexture < goalTextureLevel - 1) return false;
      if (stats.maxTriedTexture === null) return false;
      return stats.maxTriedTexture < goalTextureLevel;
    })
    .sort((a, b) => {
      if (a.lastLikedTimestamp !== b.lastLikedTimestamp) {
        return b.lastLikedTimestamp - a.lastLikedTimestamp;
      }

      const likedTextureDiff = (b.maxLikedTexture ?? 0) - (a.maxLikedTexture ?? 0);
      if (likedTextureDiff !== 0) return likedTextureDiff;

      return FRENCH_COLLATOR.compare(a.foodName, b.foodName);
    })
    .slice(0, 3)
    .map((stats) => stats.foodName);
}

export function buildTextureCoachSnapshot({
  birthDate,
  timelineEntries,
  today = new Date()
}: {
  birthDate: string | null | undefined;
  timelineEntries: FoodTimelineEntry[];
  today?: Date;
}): TextureCoachSnapshot | null {
  if (!birthDate) return null;

  const parsedBirthDate = parseIsoDate(birthDate);
  if (!parsedBirthDate) return null;

  const ageMonths = getAgeInMonths(parsedBirthDate, today);
  const target = getTextureTargetByAgeMonths(ageMonths);

  const texturedEntries = timelineEntries.filter((entry) => entry.textureLevel !== null);
  const recentTexturedEntries = [...texturedEntries]
    .sort((a, b) => {
      const dateDiff = getTimelineEntryTimestamp(b.tastedOn) - getTimelineEntryTimestamp(a.tastedOn);
      if (dateDiff !== 0) return dateDiff;
      return b.slot - a.slot;
    })
    .slice(0, RECENT_TEXTURE_ENTRY_LIMIT);

  const observedTextureLevel =
    recentTexturedEntries.length === 0
      ? null
      : clampTextureLevel(
          Math.round(
            recentTexturedEntries.reduce((sum, entry) => sum + (entry.textureLevel ?? 0), 0) /
              recentTexturedEntries.length
          )
        );

  const status = getStatus(target.min, observedTextureLevel);
  const goalTextureLevel = resolveGoalTextureLevel(target.min, observedTextureLevel);
  const observedLabel = formatTextureLevelLabel(observedTextureLevel);
  const suggestedFoods = getSuggestedFoods(timelineEntries, goalTextureLevel);
  const totalEntriesCount = timelineEntries.length;
  const texturedEntriesCount = texturedEntries.length;
  const coveragePercent =
    totalEntriesCount > 0 ? Math.round((texturedEntriesCount / totalEntriesCount) * 100) : 0;

  return {
    ageMonths,
    targetTextureMin: target.min,
    targetTextureMax: target.max,
    targetLabel: target.label,
    observedTextureLevel,
    observedLabel,
    goalTextureLevel,
    status,
    statusLabel: getStatusLabel(status),
    statusDescription: getStatusDescription(status, ageMonths, target.label, observedLabel),
    actionLabel: getActionLabel(status, goalTextureLevel),
    suggestedFoods,
    texturedEntriesCount,
    totalEntriesCount,
    coveragePercent
  };
}
