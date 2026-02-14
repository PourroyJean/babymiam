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
    name: new RegExp(`^${escapeRegExp(categoryName)}$`, "i")
  });

  await expect(categoryToggle).toBeVisible();
  return categoryToggle.locator("xpath=ancestor::article[1]");
}

async function ensureCategoryExpanded(page: Page, categoryName: string) {
  const categoryToggle = page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(categoryName)}$`, "i")
  });

  await expect(categoryToggle).toBeVisible();
  const isExpanded = await categoryToggle.getAttribute("aria-expanded");
  if (isExpanded !== "true") {
    await categoryToggle.click();
  }
}

function getExposureButton(scope: Locator, foodName: string, value: 1 | 2 | 3) {
  return scope.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(foodName)} - régler la jauge à ${value} sur 3$`, "i")
  });
}

test.describe("allergen focus", () => {
  test("shows allergen summary without a focus toggle", async ({ appPage, db }) => {
    await db.upsertFoodProgressByName("Arachides", { exposureCount: 3, note: "" });
    await db.upsertFoodProgressByName("Graines de sésame", { exposureCount: 1, note: "" });

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

    await expect(card.getByRole("button", { name: /Voir mes prochains allergènes/i })).toHaveCount(0);
    await expect(card.getByRole("button", { name: /Voir tous les allergènes/i })).toHaveCount(0);
    await expect(card.getByText("Graines de sésame", { exact: true })).toBeVisible();
    await expect(card.getByText("Arachides", { exact: true })).toBeVisible();
  });

  test("updates allergen stage to tiger when reaching 3/3", async ({ appPage, db }) => {
    await db.upsertFoodProgressByName("Arachides", { exposureCount: 2, note: "" });
    await db.upsertFoodProgressByName("Graines de sésame", { exposureCount: 3, note: "" });

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Allergènes majeurs");
    const card = await getCategoryCard(appPage, "Allergènes majeurs");

    const arachideRow = card.locator("li", { hasText: "Arachides" });
    await expect(arachideRow.getByText("Étape 2/3")).toBeVisible();

    await getExposureButton(card, "Arachides", 3).click();
    await expect
      .poll(async () => (await db.getFoodProgressByName("Arachides"))?.exposureCount ?? -1)
      .toBe(3);

    await expect(arachideRow.getByText("Tigre 3/3")).toBeVisible();
  });

  test("keeps allergen list visible even when all are consolidated", async ({ appPage, db }) => {
    for (const allergenName of OFFICIAL_ALLERGENS) {
      await db.upsertFoodProgressByName(allergenName, { exposureCount: 3, note: "" });
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
    await expect(card.getByText("Tous les allergènes sont à 3/3.")).toHaveCount(0);
  });
});
