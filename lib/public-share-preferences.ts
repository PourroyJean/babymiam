import type { PublicSharePreferenceKey } from "@/lib/types";

type PublicSharePreferenceUiConfig = {
  label: string;
  color: string;
  dialogClassName: string;
  emptyMessage: string;
};

export const PUBLIC_SHARE_PREFERENCE_KEYS: PublicSharePreferenceKey[] = ["liked", "neutral", "disliked"];

export const PUBLIC_SHARE_PREFERENCE_UI: Record<PublicSharePreferenceKey, PublicSharePreferenceUiConfig> = {
  liked: {
    label: "Aimés",
    color: "#1b8f65",
    dialogClassName: "public-share-preference-modal--liked",
    emptyMessage: "Aucun aliment dans cette catégorie pour le moment."
  },
  neutral: {
    label: "Neutres",
    color: "#7a8097",
    dialogClassName: "public-share-preference-modal--neutral",
    emptyMessage: "Aucun aliment dans cette catégorie pour le moment."
  },
  disliked: {
    label: "Pas aimés",
    color: "#b56d3b",
    dialogClassName: "public-share-preference-modal--disliked",
    emptyMessage: "Aucun aliment dans cette catégorie pour le moment."
  }
};

export function formatPublicShareFoodCountLabel(value: number) {
  return `${value} aliment${value === 1 ? "" : "s"}`;
}
