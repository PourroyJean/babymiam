export type TextureLevel = 1 | 2 | 3 | 4;
export type ReactionType = 0 | 1 | 2 | 3 | 4;

export type TextureOption = {
  level: TextureLevel;
  shortName: string;
  description: string;
  examples: string;
  iconSrc: string;
};

export type ReactionOption = {
  type: ReactionType;
  emoji: string;
  label: string;
  description: string;
};

export const DEFAULT_TEXTURE_LEVEL: TextureLevel = 1;

export const TEXTURE_OPTIONS: TextureOption[] = [
  {
    level: 1,
    shortName: "Lisse",
    description: "Tout mixé, homogène, liquide épais.",
    examples: "Purée fine, compote, yaourt.",
    iconSrc: "/images/textures/texture-1-lisse.webp"
  },
  {
    level: 2,
    shortName: "Mouliné / Écrasé",
    description: "Plus dense, granuleux mais sans vrais morceaux à mâcher.",
    examples: "Purée à la fourchette, semoule fine.",
    iconSrc: "/images/textures/texture-2-ecrase.webp"
  },
  {
    level: 3,
    shortName: "Fondant",
    description: "Morceaux tendres, s’écrasent avec la langue ou les gencives.",
    examples: "Légumes vapeur bien cuits, banane mûre.",
    iconSrc: "/images/textures/texture-3-fondant.webp"
  },
  {
    level: 4,
    shortName: "À mâcher",
    description: "Morceaux nécessitant une mastication active.",
    examples: "Viande hachée, pâtes, petits dés plus fermes, croûton de pain.",
    iconSrc: "/images/textures/texture-4-mache.webp"
  }
];

export const REACTION_OPTIONS: ReactionOption[] = [
  {
    type: 0,
    emoji: "✅",
    label: "Aucun symptôme",
    description: "RAS après le repas."
  },
  {
    type: 1,
    emoji: "🩹",
    label: "Cutanée (Peau)",
    description: "Rougeurs, plaques, urticaire, lèvres/visage gonflés."
  },
  {
    type: 2,
    emoji: "🩺",
    label: "Digestive basse (Intestins)",
    description: "Diarrhée, constipation nouvelle, maux de ventre, sang selles."
  },
  {
    type: 3,
    emoji: "🤢",
    label: "Digestive haute (Estomac)",
    description: "Vomissements répétés, reflux inhabituel."
  },
  {
    type: 4,
    emoji: "🫁",
    label: "Respiratoire (Souffle/ORL)",
    description: "Toux persistante, sifflement, gêne respiratoire, voix rauque."
  }
];

export const DEFAULT_REACTION_TYPE: ReactionType = 0;

export function isTextureLevel(value: unknown): value is TextureLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function isReactionType(value: unknown): value is ReactionType {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function getTextureOption(level: TextureLevel): TextureOption {
  return TEXTURE_OPTIONS.find((option) => option.level === level) ?? TEXTURE_OPTIONS[0];
}

export function getReactionOption(type: ReactionType | null | undefined): ReactionOption | null {
  if (type === null || type === undefined) return null;
  return REACTION_OPTIONS.find((option) => option.type === type) ?? null;
}
