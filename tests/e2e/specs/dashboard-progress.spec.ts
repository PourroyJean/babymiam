import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openSearchOverlay(page: Page) {
  await page.getByRole("button", { name: /Rechercher un aliment/i }).click();
  const dialog = page.getByRole("dialog", { name: "Recherche globale" });
  await expect(dialog).toBeVisible();
  const searchInput = dialog.getByRole("textbox", { name: "Recherche d'aliment" });
  return { dialog, searchInput };
}

function getExposureButton(scope: Locator, foodName: string, value: 1 | 2 | 3) {
  return scope.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(foodName)} - régler la jauge à ${value} sur 3$`)
  });
}

function getPreferenceButton(scope: Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(`^Préférence actuelle pour ${escapeRegExp(foodName)}:`, "i")
  });
}

function getFirstTasteButton(scope: Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(`^Marquer ${escapeRegExp(foodName)} en première bouchée$`, "i")
  });
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

test.describe("dashboard progression", () => {
  test("updates exposure and toggles back to 0 when clicking the same value", async ({
    appPage,
    db
  }) => {
    const foodName = "Épinard";

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("epinard");

    const firstTasteButton = getFirstTasteButton(dialog, foodName);
    await expect(firstTasteButton).toBeVisible();
    await expect(getExposureButton(dialog, foodName, 1)).toHaveCount(0);

    await firstTasteButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(1);

    const gauge2 = getExposureButton(dialog, foodName, 2);
    await expect(gauge2).toBeVisible();

    await gauge2.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(2);

    await gauge2.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(0);

    await expect(getFirstTasteButton(dialog, foodName)).toBeVisible();
    await expect(getExposureButton(dialog, foodName, 1)).toHaveCount(0);
  });

  test("cycles preference 0 -> 1 -> -1 -> 0 and persists after refresh", async ({ appPage, db }) => {
    const foodName = "Carotte";

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    const preferenceButton = getPreferenceButton(dialog, foodName);
    await expect(preferenceButton).toBeVisible();

    await preferenceButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.preference ?? 0, {
        timeout: 8_000
      })
      .toBe(1);

    await preferenceButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.preference ?? 0, {
        timeout: 8_000
      })
      .toBe(-1);

    await preferenceButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.preference ?? 999, {
        timeout: 8_000
      })
      .toBe(0);

    await appPage.reload();

    const { dialog: refreshedDialog, searchInput: refreshedSearchInput } = await openSearchOverlay(appPage);
    await refreshedSearchInput.fill(foodName);

    await expect(getPreferenceButton(refreshedDialog, foodName)).toHaveAttribute("aria-label", /neutre/i);
  });

  test("supports global search by button and keyboard shortcut, including accent-insensitive queries", async ({
    appPage
  }) => {
    const { dialog, searchInput } = await openSearchOverlay(appPage);

    await searchInput.fill("epinard");
    await expect(getFirstTasteButton(dialog, "Épinard")).toBeVisible();

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toBeHidden();

    await appPage.keyboard.press("Control+k");
    const reopenedDialog = appPage.getByRole("dialog", { name: "Recherche globale" });
    await expect(reopenedDialog).toBeVisible();

    await reopenedDialog.getByRole("textbox", { name: "Recherche d'aliment" }).fill("aliment-introuvable");
    await expect(reopenedDialog.getByText("Aucun aliment trouvé.")).toBeVisible();
  });

  test("one-tap first taste creates date and sets exposure to 1 for a fresh food", async ({ appPage, db }) => {
    const foodName = "Banane";
    const todayIsoDate = getTodayIsoDate();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    const firstTasteButton = getFirstTasteButton(dialog, foodName);
    await expect(firstTasteButton).toBeVisible();
    await firstTasteButton.click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(1);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBe(todayIsoDate);

    await expect(getFirstTasteButton(dialog, foodName)).toHaveCount(0);
    await expect(getExposureButton(dialog, foodName, 1)).toBeVisible();
    await expect(getExposureButton(dialog, foodName, 1)).toHaveAttribute("aria-pressed", "true");
  });

  test("gauge 1 toggled off brings back first taste button", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    const existingDate = "2025-01-20";

    await db.upsertFoodProgressByName(foodName, {
      exposureCount: 1,
      firstTastedOn: existingDate
    });
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    await expect(getFirstTasteButton(dialog, foodName)).toHaveCount(0);

    const gauge1 = getExposureButton(dialog, foodName, 1);
    await expect(gauge1).toBeVisible();
    await expect(gauge1).toHaveAttribute("aria-pressed", "true");

    await gauge1.click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(0);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBe(null);
    await expect(getFirstTasteButton(dialog, foodName)).toBeVisible();
    await expect(gauge1).toHaveCount(0);
  });

  test("gauge 2 toggled off clears first-tasted date and brings back first taste button", async ({
    appPage,
    db
  }) => {
    const foodName = "Carotte";

    await db.upsertFoodProgressByName(foodName, {
      exposureCount: 2,
      firstTastedOn: "2025-02-10"
    });
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    const gauge2 = getExposureButton(dialog, foodName, 2);
    await expect(gauge2).toBeVisible();
    await expect(gauge2).toHaveAttribute("aria-pressed", "true");

    await gauge2.click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(0);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBe(null);
    await expect(getFirstTasteButton(dialog, foodName)).toBeVisible();
    await expect(gauge2).toHaveCount(0);
  });

  test("gauge 3 toggled off clears first-tasted date and brings back first taste button", async ({
    appPage,
    db
  }) => {
    const foodName = "Épinard";

    await db.upsertFoodProgressByName(foodName, {
      exposureCount: 3,
      firstTastedOn: "2025-02-11"
    });
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("epinard");

    const gauge3 = getExposureButton(dialog, foodName, 3);
    await expect(gauge3).toBeVisible();
    await expect(gauge3).toHaveAttribute("aria-pressed", "true");

    await gauge3.click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.exposureCount ?? -1)
      .toBe(0);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.firstTastedOn ?? null)
      .toBe(null);
    await expect(getFirstTasteButton(dialog, foodName)).toBeVisible();
    await expect(gauge3).toHaveCount(0);
  });
});
