import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateToFr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

async function openSearchOverlay(page: Page) {
  await page.getByRole("button", { name: /Rechercher un aliment/i }).click();
  const dialog = page.getByRole("dialog", { name: "Recherche globale" });
  await expect(dialog).toBeVisible();
  const searchInput = dialog.getByRole("textbox", { name: "Recherche d'aliment" });
  return { dialog, searchInput };
}

function getSlotButton(scope: Locator, foodName: string, slot: 1 | 2 | 3) {
  return scope.getByRole("button", {
    name: new RegExp(
      `^${escapeRegExp(foodName)} - (ajouter l'entrée ${slot}|entrée ${slot} .*Modifier)$`,
      "i"
    )
  });
}

function getFirstBiteButton(scope: Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(`^Marquer ${escapeRegExp(foodName)} en première bouchée$`, "i")
  });
}

function getFinalPreferenceButton(scope: Locator, foodName: string) {
  return scope.getByRole("button", {
    name: new RegExp(`^Préférence finale pour ${escapeRegExp(foodName)}:`, "i")
  });
}

function getTastingEditor(page: Page, foodName: string, slot: 1 | 2 | 3) {
  return page.getByRole("dialog", {
    name: new RegExp(`${escapeRegExp(foodName)}\\s*[·-]\\s*Entrée\\s*${slot}`, "i")
  });
}

test.describe("dashboard progression", () => {
  test("creates a tasting entry on an empty food via Première bouchée", async ({ appPage, db }) => {
    const foodName = "Banane";
    const todayIsoDate = getTodayIsoDate();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    await expect(getFirstBiteButton(dialog, foodName)).toBeVisible();
    await getFirstBiteButton(dialog, foodName).click();
    const editor = getTastingEditor(appPage, foodName, 1);
    await expect(editor).toBeVisible();

    const dateInput = editor.getByLabel("Date de dégustation");
    await expect(dateInput).toHaveValue(todayIsoDate);

    await editor.getByRole("button", { name: "Oui" }).click();
    await editor.getByRole("button", { name: "Enregistrer" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastingCount ?? -1)
      .toBe(1);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.liked ?? null)
      .toBe(true);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.tastedOn ?? null)
      .toBe(todayIsoDate);
  });

  test("uses child first name in tasting popup when profile exists", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    await db.queryMany(
      `
        INSERT INTO child_profiles (owner_id, first_name, birth_date, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (owner_id)
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          birth_date = EXCLUDED.birth_date,
          updated_at = NOW();
      `,
      [ownerId, "Louise", "2024-02-15"]
    );

    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("epinard");
    await getFirstBiteButton(dialog, "Épinard").click();

    const editor = getTastingEditor(appPage, "Épinard", 1);
    await expect(editor).toBeVisible();
    await expect(editor.getByText("Louise a aimé ?")).toBeVisible();
  });

  test("toolbox toggle filters the app to already-tested foods", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Carotte", [{ slot: 1, liked: true, tastedOn: "2025-01-10" }]);
    await appPage.reload();

    const testedOnlyToggle = appPage.getByRole("switch", {
      name: "Afficher seulement les aliments déjà testés"
    });
    await testedOnlyToggle.check();

    let overlay = await openSearchOverlay(appPage);
    await overlay.searchInput.fill("epinard");
    await expect(overlay.dialog.getByText("Aucun aliment trouvé.")).toBeVisible();
    await appPage.keyboard.press("Escape");

    overlay = await openSearchOverlay(appPage);
    await overlay.searchInput.fill("carotte");
    await expect(getSlotButton(overlay.dialog, "Carotte", 1)).toBeVisible();
  });

  test("neutral tiger click always opens the next slot from the left", async ({ appPage, db }) => {
    const foodName = "Pomme";

    await db.setFoodTastingsByName(foodName, [{ slot: 1, liked: true, tastedOn: "2025-01-10" }]);
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    await getSlotButton(dialog, foodName, 3).click();
    const slot2Editor = getTastingEditor(appPage, foodName, 2);
    await expect(slot2Editor).toBeVisible();
    await expect(slot2Editor.getByText("Ajouter une dégustation.")).toBeVisible();
    await slot2Editor.getByRole("button", { name: "Annuler" }).click();
  });

  test("edits an existing slot (result and date)", async ({ appPage, db }) => {
    const foodName = "Épinard";
    const initialDate = "2025-01-10";
    const updatedDate = "2025-01-21";

    await db.setFoodTastingsByName(foodName, [{ slot: 1, liked: true, tastedOn: initialDate }]);
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("epinard");

    await getSlotButton(dialog, foodName, 1).click();
    const editor = getTastingEditor(appPage, foodName, 1);
    await expect(editor).toBeVisible();

    await editor.getByRole("button", { name: "Non" }).click();
    await editor.getByLabel("Date de dégustation").fill(updatedDate);
    await editor.getByRole("button", { name: "Enregistrer" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.liked ?? null)
      .toBe(false);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.tastedOn ?? null)
      .toBe(updatedDate);

    const filledSlotButton = getSlotButton(dialog, foodName, 1);
    await expect(filledSlotButton).toHaveAttribute(
      "aria-label",
      new RegExp(`pas aimé le ${escapeRegExp(formatDateToFr(updatedDate))}`, "i")
    );
  });

  test("allows deletion only on the highest filled slot", async ({ appPage, db }) => {
    const foodName = "Carotte";

    await db.setFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: "2025-01-10" },
      { slot: 2, liked: false, tastedOn: "2025-01-11" }
    ]);
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    await getSlotButton(dialog, foodName, 1).click();
    const slot1Editor = getTastingEditor(appPage, foodName, 1);
    await expect(slot1Editor).toBeVisible();
    await expect(slot1Editor.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
    await slot1Editor.getByRole("button", { name: "Annuler" }).click();
    await expect(slot1Editor).toBeHidden();

    await getSlotButton(dialog, foodName, 2).click();
    const slot2Editor = getTastingEditor(appPage, foodName, 2);
    await expect(slot2Editor).toBeVisible();
    await expect(slot2Editor.getByRole("button", { name: "Supprimer" })).toBeVisible();
    await slot2Editor.getByRole("button", { name: "Supprimer" }).click();
    await expect(slot2Editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastingCount ?? -1)
      .toBe(1);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.map((entry) => entry.slot).join(","))
      .toBe("1");
  });

  test("deleting last slot from 3 entries clears final preference and hides final button", async ({
    appPage,
    db
  }) => {
    const foodName = "Brocoli";

    await db.setFoodTastingsByName(
      foodName,
      [
        { slot: 1, liked: true, tastedOn: "2025-01-01" },
        { slot: 2, liked: true, tastedOn: "2025-01-02" },
        { slot: 3, liked: false, tastedOn: "2025-01-03" }
      ],
      { finalPreference: 1 }
    );
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    await expect(getFinalPreferenceButton(dialog, foodName)).toBeVisible();

    await getSlotButton(dialog, foodName, 3).click();
    const editor = getTastingEditor(appPage, foodName, 3);
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Supprimer" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastingCount ?? -1)
      .toBe(2);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.finalPreference ?? 999)
      .toBe(0);

    await expect(getFinalPreferenceButton(dialog, foodName)).toHaveCount(0);
  });

  test("keeps final preference button hidden for 0, 1 and 2 tastings", async ({ appPage, db }) => {
    const foodName = "Courgette";

    await db.setFoodTastingsByName(foodName, []);
    await appPage.reload();

    let overlay = await openSearchOverlay(appPage);
    await overlay.searchInput.fill(foodName);
    await expect(getFinalPreferenceButton(overlay.dialog, foodName)).toHaveCount(0);
    await appPage.keyboard.press("Escape");

    await db.setFoodTastingsByName(foodName, [{ slot: 1, liked: true, tastedOn: "2025-02-01" }]);
    await appPage.reload();

    overlay = await openSearchOverlay(appPage);
    await overlay.searchInput.fill(foodName);
    await expect(getFinalPreferenceButton(overlay.dialog, foodName)).toHaveCount(0);
    await appPage.keyboard.press("Escape");

    await db.setFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: "2025-02-01" },
      { slot: 2, liked: false, tastedOn: "2025-02-02" }
    ]);
    await appPage.reload();

    overlay = await openSearchOverlay(appPage);
    await overlay.searchInput.fill(foodName);
    await expect(getFinalPreferenceButton(overlay.dialog, foodName)).toHaveCount(0);
  });

  test("shows final preference button at 3 entries and cycles 0 -> 1 -> -1 -> 0", async ({
    appPage,
    db
  }) => {
    const foodName = "Carotte";

    await db.setFoodTastingsByName(
      foodName,
      [
        { slot: 1, liked: true, tastedOn: "2025-01-01" },
        { slot: 2, liked: true, tastedOn: "2025-01-02" },
        { slot: 3, liked: false, tastedOn: "2025-01-03" }
      ],
      { finalPreference: 0 }
    );
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    const finalPreferenceButton = getFinalPreferenceButton(dialog, foodName);
    await expect(finalPreferenceButton).toBeVisible();
    await expect(finalPreferenceButton).toHaveAttribute("aria-label", /neutre/i);

    await finalPreferenceButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.finalPreference ?? 999, {
        timeout: 8_000
      })
      .toBe(1);

    await finalPreferenceButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.finalPreference ?? 999, {
        timeout: 8_000
      })
      .toBe(-1);

    await finalPreferenceButton.click();
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.finalPreference ?? 999, {
        timeout: 8_000
      })
      .toBe(0);
  });

  test("supports search via button and keyboard shortcut with accent-insensitive query", async ({ appPage }) => {
    const { dialog, searchInput } = await openSearchOverlay(appPage);

    await searchInput.fill("epinard");
    await expect(getFirstBiteButton(dialog, "Épinard")).toBeVisible();

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toBeHidden();

    await appPage.keyboard.press("Control+k");
    const reopenedDialog = appPage.getByRole("dialog", { name: "Recherche globale" });
    await expect(reopenedDialog).toBeVisible();

    await reopenedDialog.getByRole("textbox", { name: "Recherche d'aliment" }).fill("aliment-introuvable");
    await expect(reopenedDialog.getByText("Aucun aliment trouvé.")).toBeVisible();
  });
});
