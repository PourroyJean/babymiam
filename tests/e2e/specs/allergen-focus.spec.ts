import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

const OFFICIAL_ALLERGENS = [
  "Céréales contenant du gluten",
  "Crustacés",
  "Oeufs",
  "Poissons",
  "Arachides",
  "Soja",
  "Lait",
  "Fruits à coque",
  "Céleri",
  "Moutarde",
  "Graines de sésame",
  "Anhydride sulfureux et sulfites",
  "Lupin",
  "Mollusques"
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getCategoryCard(page: Page, categoryName: string) {
  const categoryToggle = page.getByRole("button", {
    name: new RegExp(escapeRegExp(categoryName), "i")
  });

  await expect(categoryToggle).toBeVisible();
  return categoryToggle.locator("xpath=ancestor::article[1]");
}

async function ensureCategoryExpanded(page: Page, categoryName: string) {
  const categoryToggle = page.getByRole("button", {
    name: new RegExp(escapeRegExp(categoryName), "i")
  });

  await expect(categoryToggle).toBeVisible();
  const isExpanded = await categoryToggle.getAttribute("aria-expanded");
  if (isExpanded !== "true") {
    await categoryToggle.click();
  }
}

function getSlotButton(scope: Locator, foodName: string, slot: 1 | 2 | 3) {
  return scope.getByRole("button", {
    name: new RegExp(
      `^${escapeRegExp(foodName)} - (ajouter l'entrée ${slot}|entrée ${slot} .*Modifier)$`,
      "i"
    )
  });
}

test.describe("allergen focus", () => {
  test("shows allergen summary from tastingCount (to test / in progress / consolidated)", async ({
    appPage,
    db
  }) => {
    await db.setFoodTastingsByName("Arachides", [
      { slot: 1, liked: true, tastedOn: "2025-01-01" },
      { slot: 2, liked: true, tastedOn: "2025-01-02" },
      { slot: 3, liked: false, tastedOn: "2025-01-03" }
    ]);
    await db.setFoodTastingsByName("Graines de sésame", [
      { slot: 1, liked: true, tastedOn: "2025-01-04" }
    ]);

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Allergènes majeurs");
    const card = await getCategoryCard(appPage, "Allergènes majeurs");

    const summaryStats = card.locator(".allergen-focus-stat");
    await expect(summaryStats.nth(0)).toContainText("À tester");
    await expect(summaryStats.nth(0)).toContainText(String(OFFICIAL_ALLERGENS.length - 2));
    await expect(summaryStats.nth(1)).toContainText("En cours");
    await expect(summaryStats.nth(1)).toContainText("1");
    await expect(summaryStats.nth(2)).toContainText("Consolidés");
    await expect(summaryStats.nth(2)).toContainText("1");
  });

  test("updates allergen stage to Tigre 3/3 when a third tasting is added", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Arachides", [
      { slot: 1, liked: true, tastedOn: "2025-01-01" },
      { slot: 2, liked: false, tastedOn: "2025-01-02" }
    ]);
    await db.setFoodTastingsByName("Graines de sésame", [
      { slot: 1, liked: true, tastedOn: "2025-01-01" },
      { slot: 2, liked: true, tastedOn: "2025-01-02" },
      { slot: 3, liked: true, tastedOn: "2025-01-03" }
    ]);

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Allergènes majeurs");
    const card = await getCategoryCard(appPage, "Allergènes majeurs");

    const arachideRow = card.locator("li", { hasText: "Arachides" });
    await expect(arachideRow.getByText("Étape 2/3")).toBeVisible();

    await getSlotButton(card, "Arachides", 3).click();
    const editor = appPage.getByRole("dialog", { name: /Arachides\s*[·-]\s*Entrée\s*3/i });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Oui" }).click();
    await editor.getByRole("button", { name: "Enregistrer" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName("Arachides"))?.tastingCount ?? -1)
      .toBe(3);
    await expect(arachideRow.getByText("Tigre 3/3")).toBeVisible();
  });

  test("keeps allergen list visible when all allergens are consolidated", async ({ appPage, db }) => {
    for (const allergenName of OFFICIAL_ALLERGENS) {
      await db.setFoodTastingsByName(allergenName, [
        { slot: 1, liked: true, tastedOn: "2025-01-01" },
        { slot: 2, liked: true, tastedOn: "2025-01-02" },
        { slot: 3, liked: true, tastedOn: "2025-01-03" }
      ]);
    }

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Allergènes majeurs");
    const card = await getCategoryCard(appPage, "Allergènes majeurs");

    const arachideRow = card.locator("li", { hasText: "Arachides" });
    const sesameRow = card.locator("li", { hasText: "Graines de sésame" });
    await expect(arachideRow.getByText("Tigre 3/3")).toBeVisible();
    await expect(sesameRow.getByText("Tigre 3/3")).toBeVisible();

    await expect(card.getByText("Arachides", { exact: true })).toBeVisible();
    await expect(card.getByText("Graines de sésame", { exact: true })).toBeVisible();
  });
});
