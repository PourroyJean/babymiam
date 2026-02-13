import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDateButton(scope: Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(
      `^(Ajouter une date pour|Voir la date de) ${escapeRegExp(foodName)}$`,
      "i"
    )
  });
}

function getNoteButton(scope: Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(
      `^(Ajouter une note pour|Éditer la note de) ${escapeRegExp(foodName)}$`,
      "i"
    )
  });
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

test.describe("food meta", () => {
  test("adds, updates, then clears first tasted date", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await ensureCategoryExpanded(appPage, "Légumes");

    await getDateButton(appPage, foodName).click();

    const dialog = appPage.getByRole("dialog", { name: foodName });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Date de première fois").fill("2025-01-15");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBe("2025-01-15");

    await dialog.getByRole("button", { name: "Fermer le panneau d'édition" }).click();

    await ensureCategoryExpanded(appPage, "Légumes");
    await getDateButton(appPage, foodName).click();
    await dialog.getByLabel("Date de première fois").fill("2025-01-20");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBe("2025-01-20");

    await dialog.getByRole("button", { name: "Effacer" }).click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBeNull();
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

  test("closes editor modal with Escape and overlay click", async ({ appPage }) => {
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
