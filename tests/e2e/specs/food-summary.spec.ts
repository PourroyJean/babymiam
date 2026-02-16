import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function openSearchOverlay(page: Page) {
  await page.getByRole("button", { name: /Rechercher un aliment/i }).click();
  const dialog = page.getByRole("dialog", { name: "Recherche globale" });
  await expect(dialog).toBeVisible();
  const searchInput = dialog.getByRole("textbox", { name: "Recherche d'aliment" });
  return { dialog, searchInput };
}

async function openTimelineOverlay(page: Page) {
  await page.getByRole("button", { name: /Carnets de bords/i }).click();
  const dialog = page.getByRole("dialog", { name: /Carnets de bords/i });
  await expect(dialog).toBeVisible();
  return { dialog };
}

function getFoodSummaryTrigger(scope: Page | Locator, foodName: string) {
  return scope.getByRole("button", { name: `Ouvrir le résumé de ${foodName}` });
}

function getFoodSummaryDialog(page: Page, foodName: string) {
  return page.getByRole("dialog", { name: foodName });
}

test.describe("food summary modal", () => {
  test("opens a summary from the category grid (name + category)", async ({ appPage }) => {
    await ensureCategoryExpanded(appPage, "Légumes");

    await getFoodSummaryTrigger(appPage, "Brocoli").click();

    const dialog = getFoodSummaryDialog(appPage, "Brocoli");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Légumes/i)).toBeVisible();
  });

  test("shows 0-3 tasting history lines with correct tiger icons", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await db.setFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: "2026-02-07" },
      { slot: 2, liked: false, tastedOn: "2026-02-08" },
      { slot: 3, liked: true, tastedOn: "2026-02-09" }
    ]);

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Légumes");
    await getFoodSummaryTrigger(appPage, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();

    const historyRegion = dialog.getByRole("region", { name: /Historique des dégustations/i });
    await expect(historyRegion.getByRole("listitem")).toHaveCount(3);
    await expect(historyRegion.locator('img[src*="smiley_ok.png"]')).toHaveCount(2);
    await expect(historyRegion.locator('img[src*="smiley_ko.png"]')).toHaveCount(1);
  });

  test("shows tasting notes in history lines", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await db.setFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: "2026-02-07", note: "note slot 1" },
      { slot: 2, liked: false, tastedOn: "2026-02-08", note: "" },
      { slot: 3, liked: true, tastedOn: "2026-02-09", note: "note slot 3" }
    ]);

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Légumes");
    await getFoodSummaryTrigger(appPage, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();

    const historyRegion = dialog.getByRole("region", { name: /Historique des dégustations/i });
    await expect(historyRegion.getByText("note slot 1")).toBeVisible();
    await expect(historyRegion.getByText("note slot 3")).toBeVisible();
  });

  test("edits notes directly from the summary modal (trimmed)", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await ensureCategoryExpanded(appPage, "Légumes");

    await getFoodSummaryTrigger(appPage, foodName).click();
    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox", { name: "Note" }).fill("  Première note  ");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.note ?? "")
      .toBe("Première note");
  });

  test("stacks on top of Timeline and Escape closes only the summary", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await db.setFoodTastingsByName(foodName, [{ slot: 1, liked: true, tastedOn: "2026-02-07" }]);
    await appPage.reload();

    const timeline = await openTimelineOverlay(appPage);
    await getFoodSummaryTrigger(timeline.dialog, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();
    await expect(timeline.dialog).toBeVisible();

    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(timeline.dialog).toBeVisible();
  });

  test("stacks on top of Search and Escape closes only the summary", async ({ appPage }) => {
    const foodName = "Brocoli";
    const overlay = await openSearchOverlay(appPage);
    await overlay.searchInput.fill(foodName);

    await getFoodSummaryTrigger(overlay.dialog, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();
    await expect(overlay.dialog).toBeVisible();

    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(overlay.dialog).toBeVisible();
  });
});
