type CategoryUiConfig = {
  pictogram: string;
  toneClass: string;
};

export const CATEGORY_UI_BY_NAME: Record<string, CategoryUiConfig> = {
  "Légumes": { pictogram: "🥕", toneClass: "tone-vegetables" },
  "Fruits": { pictogram: "🍓", toneClass: "tone-fruits" },
  "Féculents & céréales": { pictogram: "🍞", toneClass: "tone-starch" },
  "Protéines animales": { pictogram: "🍖", toneClass: "tone-proteins" },
  "Fruits à coque & graines": { pictogram: "🌰", toneClass: "tone-oils" },
  "Herbes & épices": { pictogram: "🌿", toneClass: "tone-herbs" },
  // Legacy labels kept for backward compatibility during transition.
  "Féculents": { pictogram: "🍞", toneClass: "tone-starch" },
  "Protéines": { pictogram: "🍖", toneClass: "tone-proteins" },
  "Légumineuses": { pictogram: "🫘", toneClass: "tone-legumes" },
  "Produits laitiers": { pictogram: "🥛", toneClass: "tone-dairy" },
  "Allergènes majeurs": { pictogram: "✨", toneClass: "tone-allergens" },
  "Épices": { pictogram: "🌶️", toneClass: "tone-spices" },
  "Oléagineux et huiles": { pictogram: "🫒", toneClass: "tone-oils" },
  "Herbes et aromates": { pictogram: "🌿", toneClass: "tone-herbs" },
  "Sucreries": { pictogram: "🍬", toneClass: "tone-sweets" },
  "Condiments": { pictogram: "🧂", toneClass: "tone-condiments" },
  "Autres": { pictogram: "🍽️", toneClass: "tone-other" }
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
