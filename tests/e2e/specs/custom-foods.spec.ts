import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFoodName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

async function openAddFoodPanel(page: Page) {
  await page.getByRole("button", { name: /Ajouter un aliment/i }).click();
  const dialog = page.getByRole("dialog", { name: "Ajouter un aliment" });
  await expect(dialog).toBeVisible();

  return {
    dialog,
    categorySelect: dialog.getByLabel("Catégorie"),
    nameInput: dialog.getByLabel("Nom de l'aliment"),
    addButton: dialog.getByRole("button", { name: "Ajouter" })
  };
}

async function addFood(page: Page, categoryName: string, foodName: string) {
  const panel = await openAddFoodPanel(page);
  await panel.categorySelect.selectOption({ label: categoryName });
  await panel.nameInput.fill(foodName);
  await panel.addButton.click();
  await expect(page.getByRole("dialog", { name: "Ajouter un aliment" })).toHaveCount(0);
  await waitForFoodInCategory(page, categoryName, foodName);
}

function getFoodSummaryTrigger(page: Page, foodName: string) {
  return page.getByRole("button", { name: `Ouvrir le résumé de ${foodName}` });
}

async function waitForFoodInCategory(page: Page, categoryName: string, foodName: string) {
  await ensureCategoryExpanded(page, categoryName);
  await expect(getFoodSummaryTrigger(page, foodName)).toBeVisible({ timeout: 15_000 });
}

function getFoodSummaryDialog(page: Page, foodName: string) {
  return page.getByRole("dialog", { name: foodName });
}

function sortFoodNamesAlphabetically(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

async function getCategoryFoodNames(page: Page, categoryName: string) {
  const categoryToggle = page.getByRole("button", {
    name: new RegExp(escapeRegExp(categoryName), "i")
  });
  const categoryCard = categoryToggle.locator("xpath=ancestor::article[1]");
  const summaryButtons = categoryCard.locator(
    'ul.category-list.open button[aria-label^="Ouvrir le résumé de "]'
  );

  await expect(summaryButtons.first()).toBeVisible();
  const names = await summaryButtons.allTextContents();
  return names.map((name) => name.trim()).filter(Boolean);
}

test.describe("custom foods", () => {
  test("adds a user-owned food from toolbox in an existing category", async ({ appPage, db }) => {
    const foodName = "Patate douce perso";
    const ownerId = await db.getDefaultOwnerId();

    await addFood(appPage, "Légumes", foodName);
    await ensureCategoryExpanded(appPage, "Légumes");
    await expect(getFoodSummaryTrigger(appPage, foodName)).toBeVisible();

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ owner_id: number | null }>(
          `
            SELECT owner_id
            FROM foods
            WHERE name = $1
            ORDER BY id DESC
            LIMIT 1;
          `,
          [foodName]
        );
        return row ? Number(row.owner_id) : null;
      })
      .toBe(ownerId);
  });

  test("keeps manual foods sorted alphabetically in the category list", async ({ appPage }) => {
    const categoryName = "Légumes";
    const foodName = "Aubergine perso";

    await addFood(appPage, categoryName, foodName);
    await ensureCategoryExpanded(appPage, categoryName);
    await expect(getFoodSummaryTrigger(appPage, foodName)).toBeVisible();

    const namesBeforeReload = await getCategoryFoodNames(appPage, categoryName);
    expect(namesBeforeReload).toContain(foodName);
    expect(namesBeforeReload).toEqual(sortFoodNamesAlphabetically(namesBeforeReload));

    await appPage.reload();
    await ensureCategoryExpanded(appPage, categoryName);
    await expect(getFoodSummaryTrigger(appPage, foodName)).toBeVisible();

    const namesAfterReload = await getCategoryFoodNames(appPage, categoryName);
    expect(namesAfterReload).toContain(foodName);
    expect(namesAfterReload).toEqual(sortFoodNamesAlphabetically(namesAfterReload));
  });

  test("rejects duplicates case- and accent-insensitively", async ({ appPage, db }) => {
    const foodName = "Patate douce doublon";
    const categoryName = "Légumes";
    await addFood(appPage, "Légumes", foodName);

    const panel = await openAddFoodPanel(appPage);
    await panel.categorySelect.selectOption({ label: "Légumes" });
    await panel.nameInput.fill("PÂTATE DOUCE DOUBLON");
    await panel.addButton.click();

    await expect(panel.dialog.getByText("Cet aliment existe déjà dans cette catégorie.")).toBeVisible();

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ count: string }>(
          `
            SELECT COUNT(*)::text AS count
            FROM foods
            WHERE owner_id IS NOT NULL
              AND normalized_name = $1
              AND category_id = (
                SELECT id
                FROM categories
                WHERE name = $2
                LIMIT 1
              );
          `,
          [normalizeFoodName(foodName), categoryName]
        );
        return Number(row?.count || "0");
      })
      .toBe(1);
  });

  test("shows delete button only for user-owned foods in summary panel", async ({ appPage }) => {
    await ensureCategoryExpanded(appPage, "Légumes");

    await getFoodSummaryTrigger(appPage, "Brocoli").click();
    const globalDialog = getFoodSummaryDialog(appPage, "Brocoli");
    await expect(globalDialog).toBeVisible();
    await expect(globalDialog.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
    await globalDialog.getByRole("button", { name: "Annuler" }).click();
    await expect(globalDialog).toBeHidden();

    const userFood = "Topinambour perso";
    await addFood(appPage, "Légumes", userFood);
    await ensureCategoryExpanded(appPage, "Légumes");

    await getFoodSummaryTrigger(appPage, userFood).click();
    const userDialog = getFoodSummaryDialog(appPage, userFood);
    await expect(userDialog).toBeVisible();
    await expect(userDialog.getByRole("button", { name: "Supprimer" })).toBeVisible();
  });

  test("deletes a user-owned food from summary panel", async ({ appPage, db }) => {
    const userFood = "Navet perso";
    await addFood(appPage, "Légumes", userFood);
    await ensureCategoryExpanded(appPage, "Légumes");

    await getFoodSummaryTrigger(appPage, userFood).click();
    const dialog = getFoodSummaryDialog(appPage, userFood);
    await expect(dialog).toBeVisible();
    appPage.once("dialog", (confirmDialog) => {
      void confirmDialog.accept();
    });
    await dialog.getByRole("button", { name: "Supprimer" }).click();
    await expect(dialog).toBeHidden();

    await expect(getFoodSummaryTrigger(appPage, userFood)).toHaveCount(0);

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ count: string }>(
          `
            SELECT COUNT(*)::text AS count
            FROM foods
            WHERE name = $1;
          `,
          [userFood]
        );
        return Number(row?.count || "0");
      })
      .toBe(0);
  });
});
