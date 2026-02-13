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

test.describe("dashboard progression", () => {
  test("updates exposure and toggles back to 0 when clicking the same value", async ({
    appPage,
    db
  }) => {
    const foodName = "Épinard";

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("epinard");

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
    await expect(getExposureButton(dialog, "Épinard", 1)).toBeVisible();

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toBeHidden();

    await appPage.keyboard.press("Control+k");
    const reopenedDialog = appPage.getByRole("dialog", { name: "Recherche globale" });
    await expect(reopenedDialog).toBeVisible();

    await reopenedDialog.getByRole("textbox", { name: "Recherche d'aliment" }).fill("aliment-introuvable");
    await expect(reopenedDialog.getByText("Aucun aliment trouvé.")).toBeVisible();
  });
});
