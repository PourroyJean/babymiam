type CategoryUiConfig = {
  pictogram: string;
  toneClass: string;
};

export const CATEGORY_UI_BY_NAME: Record<string, CategoryUiConfig> = {
  "Légumes": { pictogram: "🥕", toneClass: "tone-vegetables" },
  "Fruits": { pictogram: "🍓", toneClass: "tone-fruits" },
  "Féculents & céréales": { pictogram: "🍞", toneClass: "tone-starch" },
  "Légumineuses": { pictogram: "🫘", toneClass: "tone-legumes" },
  "Protéines animales": { pictogram: "🍖", toneClass: "tone-proteins" },
  "Produits laitiers": { pictogram: "🥛", toneClass: "tone-dairy" },
  "Fruits à coque & graines": { pictogram: "🌰", toneClass: "tone-oils" },
  "Herbes & épices": { pictogram: "🌿", toneClass: "tone-herbs" },
  "Allergènes majeurs": { pictogram: "✨", toneClass: "tone-allergens" }
};

const DEFAULT_CATEGORY_UI: CategoryUiConfig = {
  pictogram: "✨",
  toneClass: "tone-other"
};

export const CATEGORY_TONE_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_UI_BY_NAME).map(([categoryName, config]) => [categoryName, config.toneClass])
) as Record<string, string>;

export function getCategoryUi(categoryName: string): CategoryUiConfig {
  return CATEGORY_UI_BY_NAME[categoryName] || DEFAULT_CATEGORY_UI;
}
