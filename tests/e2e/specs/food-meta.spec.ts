import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDateButton(scope: Page | Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(`^(Ajouter une date pour|Voir la date de) ${escapeRegExp(foodName)}$`, "i")
  });
}

function getNoteButton(scope: Page | Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(`^(Ajouter une note pour|Éditer la note de) ${escapeRegExp(foodName)}$`, "i")
  });
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

test.describe("food meta", () => {
  test("keeps only note editor (no date action)", async ({ appPage }) => {
    const foodName = "Brocoli";
    await ensureCategoryExpanded(appPage, "Légumes");

    await expect(getDateButton(appPage, foodName)).toHaveCount(0);
    await expect(getNoteButton(appPage, foodName)).toBeVisible();

    await getNoteButton(appPage, foodName).click();
    const dialog = appPage.getByRole("dialog", { name: foodName });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Note")).toBeVisible();
    await expect(dialog.getByLabel("Date de première fois")).toHaveCount(0);
  });

  test("saves and trims notes", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await ensureCategoryExpanded(appPage, "Légumes");

    await getNoteButton(appPage, foodName).click();

    const dialog = appPage.getByRole("dialog", { name: foodName });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Note").fill("  Première note  ");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.note ?? "")
      .toBe("Première note");

    await ensureCategoryExpanded(appPage, "Légumes");
    await getNoteButton(appPage, foodName).click();
    await dialog.getByLabel("Note").fill("Deuxième note");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.note ?? "")
      .toBe("Deuxième note");
  });

  test("closes note editor modal with Escape and overlay click", async ({ appPage }) => {
    const foodName = "Brocoli";
    await ensureCategoryExpanded(appPage, "Légumes");

    await getNoteButton(appPage, foodName).click();

    const dialog = appPage.getByRole("dialog", { name: foodName });
    await expect(dialog).toBeVisible();

    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await ensureCategoryExpanded(appPage, "Légumes");
    await getNoteButton(appPage, foodName).click();
    await expect(dialog).toBeVisible();

    await appPage.mouse.click(4, 4);
    await expect(dialog).toBeHidden();
  });
});
