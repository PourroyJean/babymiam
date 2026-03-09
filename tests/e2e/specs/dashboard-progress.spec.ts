import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

const DEFAULT_E2E_AUTH_EMAIL = (process.env.E2E_AUTH_EMAIL || "e2e-parent@example.test").toLowerCase();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTodayLocalIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function getIsoDateDaysAgo(daysAgo: number) {
  const normalizedDaysAgo = Math.max(0, Math.trunc(daysAgo));
  const now = new Date();
  now.setDate(now.getDate() - normalizedDaysAgo);
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function getIsoDateMonthsAgoOnFirstDay(monthsAgo: number) {
  const normalizedMonthsAgo = Math.max(0, Math.trunc(monthsAgo));
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - normalizedMonthsAgo, 1);
  const localDate = new Date(target.getTime() - target.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
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

async function openQuickAddPanel(page: Page) {
  await page.getByRole("button", { name: /Ajout rapide/i }).click();
  const dialog = page.getByRole("dialog", { name: "Ajout rapide" });
  await expect(dialog).toBeVisible();

  const searchInput = dialog.getByRole("textbox", { name: "Rechercher un aliment" });
  const dateInput = dialog.getByLabel("Date");
  const noteInput = dialog.getByLabel("Note du test");
  const addButton = dialog.getByRole("button", { name: "Ajouter" });

  return { dialog, searchInput, dateInput, noteInput, addButton };
}

async function openWeeklyPlanPanel(page: Page) {
  await page.getByRole("button", { name: /Plan 7 jours/i }).click();
  const dialog = page.getByRole("dialog", { name: /Plan 7 jours/i });
  await expect(dialog).toBeVisible();
  return { dialog };
}

async function openTimelinePanel(page: Page) {
  await page.getByRole("button", { name: /Carnets de bords/i }).click();
  const dialog = page.getByRole("dialog", { name: /Carnets de bords/i });
  await expect(dialog).toBeVisible();
  return { dialog };
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
    const todayIsoDate = getTodayLocalIsoDate();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);

    await expect(getFirstBiteButton(dialog, foodName)).toBeVisible();
    await getFirstBiteButton(dialog, foodName).click();
    const editor = getTastingEditor(appPage, foodName, 1);
    await expect(editor).toBeVisible();

    const dateInput = editor.getByLabel("Date de dégustation");
    await expect(dateInput).toHaveValue(todayIsoDate);

    await editor.getByRole("button", { name: /Fondant/i }).click();
    await editor.getByLabel(/Réaction observée/i).selectOption("3");
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
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.textureLevel ?? null)
      .toBe(3);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.reactionType ?? null)
      .toBe(3);
  });

  test("shows tri-state tiger choices with indecis centered in tasting editor and quick add", async ({ appPage }) => {
    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("banane");
    await getFirstBiteButton(dialog, "Banane").click();

    const editor = getTastingEditor(appPage, "Banane", 1);
    await expect(editor).toBeVisible();

    const editorChoices = await editor
      .locator(".quick-add-tiger-choice button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(editorChoices).toEqual(["Oui", "Indécis", "Non"]);
    await editor.getByRole("button", { name: "Annuler" }).click();
    await expect(editor).toBeHidden();
    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const quickAdd = await openQuickAddPanel(appPage);
    const quickAddChoices = await quickAdd.dialog
      .locator(".quick-add-tiger-choice button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(quickAddChoices).toEqual(["Tigre OK", "Tigre indécis", "Tigre KO"]);
  });

  test("persists indecis as NULL from tasting editor and shows the indecis tiger", async ({ appPage, db }) => {
    const foodName = "Banane";
    const todayIsoDate = getTodayLocalIsoDate();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill(foodName);
    await getFirstBiteButton(dialog, foodName).click();

    const editor = getTastingEditor(appPage, foodName, 1);
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Indécis" }).click();
    await editor.getByLabel("Date de dégustation").fill(todayIsoDate);
    await editor.getByRole("button", { name: "Enregistrer" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.liked)
      .toBe(null);

    const slot1Button = getSlotButton(dialog, foodName, 1);
    await expect(slot1Button).toHaveAttribute("aria-label", /indécis/i);
    await expect(slot1Button.locator('img[src*="smiley-indecis.webp"]')).toHaveCount(1);
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

  test("shows a clickable age guide frieze with direct actions when the child profile is known", async ({
    appPage,
    db
  }) => {
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
      [ownerId, "Louise", getIsoDateMonthsAgoOnFirstDay(7)]
    );

    await appPage.reload();

    const guidancePanel = appPage.getByRole("region", { name: "Le Guide" });
    await expect(guidancePanel.getByRole("button", { name: /6-8 mois/i })).toHaveAttribute("aria-pressed", "true");
    await expect(guidancePanel.getByRole("button", { name: /Avant 5 m/i })).toBeVisible();
    await expect(guidancePanel.getByRole("button", { name: /12-18 mois/i })).toBeVisible();
    await expect(guidancePanel.getByRole("button", { name: /18-36 mois/i })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Faire grandir les repas sans brusquer" })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Observer avant d'accélérer" })).toBeVisible();
    await expect(
      guidancePanel.getByText(
        "Texture: purées moins lisses, plus épaisses, légèrement granuleuses. Premiers morceaux fondants si bébé tient assis avec maintien."
      )
    ).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Préparation" })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Élargir les bases du quotidien" })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Introduire de très petites portions bien mixées" })).toBeVisible();

    await guidancePanel.getByRole("button", { name: /9-11 mois/i }).click();
    await expect(guidancePanel.getByRole("button", { name: /9-11 mois/i })).toHaveAttribute("aria-pressed", "true");
    await expect(guidancePanel.getByRole("heading", { name: "9-11 mois" })).toBeVisible();
    await expect(guidancePanel.getByText("Cette colonne accueillera les points de vigilance et les repères transverses.")).toBeVisible();

    await expect(guidancePanel.getByRole("button", { name: "Rechercher un aliment" })).toHaveCount(0);
    await expect(guidancePanel.getByRole("button", { name: "Ajouter une dégustation" })).toHaveCount(0);
  });

  test("shows the guide even without birth date and lets the parent browse the blocks", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    await db.queryMany("DELETE FROM child_profiles WHERE owner_id = $1;", [ownerId]);

    await appPage.reload();

    const guidancePanel = appPage.getByRole("region", { name: "Le Guide" });
    await expect(guidancePanel.getByRole("button", { name: /5 mois/i })).toHaveAttribute("aria-pressed", "true");
    await expect(guidancePanel.getByRole("heading", { name: "Signes que bébé pourrait être prêt" })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Rester souple et progressif" })).toBeVisible();
    await expect(guidancePanel.getByText("Texture conseillée: purée lisse")).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Préparation" })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Préparer une première purée très simple" })).toBeVisible();
    await expect(guidancePanel.getByRole("heading", { name: "Introduire les fruits après quinze jours environ" })).toBeVisible();

    await guidancePanel.getByRole("button", { name: /18-36 mois/i }).click();
    await expect(guidancePanel.getByRole("button", { name: /18-36 mois/i })).toHaveAttribute("aria-pressed", "true");
    await expect(guidancePanel.getByRole("heading", { name: "18-36 mois" })).toBeVisible();
    await expect(guidancePanel.getByText("Les repères détaillés de cette tranche d'âge seront ajoutés ici.")).toBeVisible();
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

    await db.setFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: initialDate, textureLevel: 1, reactionType: 0 }
    ]);
    await appPage.reload();

    const { dialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("epinard");

    await getSlotButton(dialog, foodName, 1).click();
    const editor = getTastingEditor(appPage, foodName, 1);
    await expect(editor).toBeVisible();

    await editor.getByRole("button", { name: "Non" }).click();
    await editor.getByLabel("Date de dégustation").fill(updatedDate);
    await editor.getByRole("button", { name: /À mâcher/i }).click();
    await editor.getByLabel(/Réaction observée/i).selectOption("1");
    await editor.getByRole("button", { name: "Enregistrer" }).click();
    await expect(editor).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.liked ?? null)
      .toBe(false);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.tastedOn ?? null)
      .toBe(updatedDate);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.textureLevel ?? null)
      .toBe(4);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.reactionType ?? null)
      .toBe(1);

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

  test("timeline sorts by day desc, slot desc, then food name asc (fr)", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Banane", [{ slot: 3, liked: true, tastedOn: "2025-01-12" }]);
    await db.setFoodTastingsByName("Brocoli", [{ slot: 2, liked: false, tastedOn: "2025-01-12" }]);
    await db.setFoodTastingsByName("Carotte", [{ slot: 2, liked: true, tastedOn: "2025-01-12" }]);
    await db.setFoodTastingsByName("Épinard", [{ slot: 1, liked: true, tastedOn: "2025-01-10" }]);

    await appPage.reload();

    const { dialog } = await openTimelinePanel(appPage);
    const dayItems = dialog.locator(".food-timeline-day-item");
    const foodButtons = dialog.locator(".food-timeline-entry .food-timeline-food-name");
    const entryCards = dialog.locator(".food-timeline-entry");

    await expect(dayItems).toHaveCount(2);
    await expect(foodButtons).toHaveCount(4);

    await expect(foodButtons.nth(0)).toHaveText("Banane");
    await expect(foodButtons.nth(1)).toHaveText("Brocoli");
    await expect(foodButtons.nth(2)).toHaveText("Carotte");
    await expect(foodButtons.nth(3)).toHaveText("Épinard");

    await expect(entryCards.nth(0)).toContainText("3/3");
    await expect(entryCards.nth(1)).toContainText("2/3");
    await expect(entryCards.nth(2)).toContainText("2/3");
    await expect(entryCards.nth(3)).toContainText("1/3");

    await expect(dayItems.nth(0)).toContainText("Banane");
    await expect(dayItems.nth(0)).toContainText("Brocoli");
    await expect(dayItems.nth(0)).toContainText("Carotte");
    await expect(dayItems.nth(1)).toContainText("Épinard");
  });

  test("weekly plan proposes a 7-day roadmap and can prefill quick add from the daily action", async ({
    appPage,
    db
  }) => {
    await db.setFoodTastingsByName("Carotte", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(22) }]);
    await db.setFoodTastingsByName("Épinard", [
      { slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(18) },
      { slot: 2, liked: false, tastedOn: getIsoDateDaysAgo(17) }
    ]);
    await db.setFoodTastingsByName("Arachides", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(9) }]);
    await db.setFoodTastingsByName("Lait", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(11) }]);

    await appPage.reload();

    const weeklyPlanTrigger = appPage.getByRole("button", { name: /Plan 7 jours/i });
    await expect(weeklyPlanTrigger).toContainText(/relance/i);
    await expect(weeklyPlanTrigger).toContainText(/découverte/i);
    await expect(weeklyPlanTrigger).toContainText(/allergène/i);
    await expect(weeklyPlanTrigger).toContainText(/consolidation/i);

    const { dialog } = await openWeeklyPlanPanel(appPage);
    await expect(dialog.getByRole("button", { name: /Relances/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Découvertes/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Allergènes à suivre/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Consolidation/i })).toBeVisible();
    await expect(dialog.getByText("Nouveaux aliments")).toHaveCount(0);
    await expect(dialog.locator(".weekly-plan-item")).toHaveCount(7);

    const firstItem = dialog.locator(".weekly-plan-item").first();
    const firstFoodName = ((await firstItem.locator(".weekly-plan-food-name").textContent()) || "").trim();
    expect(firstFoodName).not.toBe("");
    await firstItem
      .getByRole("button", { name: new RegExp(`Tester maintenant ${escapeRegExp(firstFoodName)}`, "i") })
      .click();

    const quickAddDialog = appPage.getByRole("dialog", { name: "Ajout rapide" });
    await expect(quickAddDialog).toBeVisible();
    await expect(quickAddDialog.getByRole("textbox", { name: "Rechercher un aliment" })).toHaveValue(firstFoodName);
    await expect(dialog).toHaveCount(0);
  });

  test("quick add closes after success when opened from a prefilled weekly-plan action", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Carotte", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(20) }]);
    await db.setFoodTastingsByName("Épinard", [
      { slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(14) },
      { slot: 2, liked: false, tastedOn: getIsoDateDaysAgo(11) }
    ]);
    await db.setFoodTastingsByName("Arachides", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(7) }]);
    await db.setFoodTastingsByName("Lait", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(5) }]);

    await appPage.reload();

    const { dialog } = await openWeeklyPlanPanel(appPage);
    const firstItem = dialog.locator(".weekly-plan-item").first();
    const firstFoodName = ((await firstItem.locator(".weekly-plan-food-name").textContent()) || "").trim();
    const initialTastingCount = (await db.getFoodProgressByName(firstFoodName))?.tastingCount ?? 0;

    await firstItem
      .getByRole("button", { name: new RegExp(`Tester maintenant ${escapeRegExp(firstFoodName)}`, "i") })
      .click();

    const quickAddDialog = appPage.getByRole("dialog", { name: "Ajout rapide" });
    await expect(quickAddDialog).toBeVisible();
    await quickAddDialog.getByRole("button", { name: "Tigre OK" }).click();
    await quickAddDialog.getByRole("button", { name: "Ajouter" }).click();

    await expect(quickAddDialog).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await db.getFoodProgressByName(firstFoodName))?.tastingCount ?? -1)
      .toBe(initialTastingCount + 1);
  });

  test("weekly plan top cards toggle filters and keep a single active tab", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Carotte", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(20) }]);
    await db.setFoodTastingsByName("Épinard", [
      { slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(12) },
      { slot: 2, liked: false, tastedOn: getIsoDateDaysAgo(9) }
    ]);
    await db.setFoodTastingsByName("Brocoli", [
      { slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(4) },
      { slot: 2, liked: true, tastedOn: getIsoDateDaysAgo(3) }
    ]);
    await db.setFoodTastingsByName("Arachides", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(8) }]);
    await db.setFoodTastingsByName("Lait", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(3) }]);

    await appPage.reload();

    const { dialog } = await openWeeklyPlanPanel(appPage);
    const relaunchFilter = dialog.getByRole("button", { name: /Relances/i });
    const discoveryFilter = dialog.getByRole("button", { name: /Découvertes/i });
    const allergenFilter = dialog.getByRole("button", { name: /Allergènes à suivre/i });
    const consolidationFilter = dialog.getByRole("button", { name: /Consolidation/i });
    const allItems = dialog.locator(".weekly-plan-item");

    await expect(relaunchFilter).toBeVisible();
    await expect(discoveryFilter).toBeVisible();
    await expect(allergenFilter).toBeVisible();
    await expect(consolidationFilter).toBeVisible();
    await expect(dialog.getByText("Nouveaux aliments")).toHaveCount(0);
    await expect(allItems).toHaveCount(7);

    await relaunchFilter.click();
    await expect(relaunchFilter).toHaveAttribute("aria-pressed", "true");
    await expect(allItems).not.toHaveCount(0);
    const relaunchFocuses = await dialog.locator(".weekly-plan-item .weekly-plan-focus").allTextContents();
    expect(relaunchFocuses.every((value) => /Relance/i.test(value))).toBe(true);

    await relaunchFilter.click();
    await expect(relaunchFilter).toHaveAttribute("aria-pressed", "false");
    await expect(discoveryFilter).toHaveAttribute("aria-pressed", "false");
    await expect(allItems).toHaveCount(7);

    await discoveryFilter.click();
    await expect(relaunchFilter).toHaveAttribute("aria-pressed", "false");
    await expect(discoveryFilter).toHaveAttribute("aria-pressed", "true");
    const discoveryFocuses = await dialog.locator(".weekly-plan-item .weekly-plan-focus").allTextContents();
    expect(discoveryFocuses.length).toBeGreaterThan(0);
    expect(discoveryFocuses.every((value) => /Découverte/i.test(value))).toBe(true);

    await allergenFilter.click();
    await expect(relaunchFilter).toHaveAttribute("aria-pressed", "false");
    await expect(discoveryFilter).toHaveAttribute("aria-pressed", "false");
    await expect(allergenFilter).toHaveAttribute("aria-pressed", "true");
    const allergenFocuses = await dialog.locator(".weekly-plan-item .weekly-plan-focus").allTextContents();
    expect(allergenFocuses.length).toBeGreaterThan(0);
    expect(allergenFocuses.every((value) => /Allergène/i.test(value))).toBe(true);

    await consolidationFilter.click();
    await expect(allergenFilter).toHaveAttribute("aria-pressed", "false");
    await expect(consolidationFilter).toHaveAttribute("aria-pressed", "true");
    const consolidationFocuses = await dialog.locator(".weekly-plan-item .weekly-plan-focus").allTextContents();
    expect(consolidationFocuses.length).toBeGreaterThan(0);
    expect(consolidationFocuses.every((value) => /Consolidation/i.test(value))).toBe(true);
  });

  test("weekly plan abandon filter uses a 10-day threshold", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Carotte", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(20) }]);
    await db.setFoodTastingsByName("Épinard", [
      { slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(9) },
      { slot: 2, liked: false, tastedOn: getIsoDateDaysAgo(8) }
    ]);
    await db.setFoodTastingsByName("Arachides", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(4) }]);
    await db.setFoodTastingsByName("Lait", [{ slot: 1, liked: true, tastedOn: getIsoDateDaysAgo(2) }]);

    await appPage.reload();

    const { dialog } = await openWeeklyPlanPanel(appPage);
    const relaunchFilter = dialog.getByRole("button", { name: /Relances/i });

    await relaunchFilter.click();
    const relaunchItems = dialog.locator(".weekly-plan-item");
    await expect(relaunchItems).toHaveCount(1);
    await expect(relaunchItems.first()).toContainText("Carotte");
    await expect(relaunchItems.first()).not.toContainText("Épinard");
  });

  test("weekly plan shows the premium lock state when user has no access", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    await db.queryMany("UPDATE users SET email = $2 WHERE id = $1;", [ownerId, "weekly-plan-free@example.test"]);

    try {
      await appPage.reload();
      const { dialog } = await openWeeklyPlanPanel(appPage);
      await expect(dialog.getByRole("heading", { name: "Fonction Premium" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: /Voir mon espace premium/i })).toBeVisible();
      await expect(dialog.locator(".weekly-plan-item")).toHaveCount(0);
    } finally {
      await db.queryMany("UPDATE users SET email = $2 WHERE id = $1;", [ownerId, DEFAULT_E2E_AUTH_EMAIL]);
    }
  });

  test("keeps overlays exclusive between Search, Timeline, Weekly Plan and Quick Add", async ({ appPage }) => {
    await appPage.getByRole("button", { name: /Carnets de bords/i }).click();
    await expect(appPage.getByRole("dialog", { name: /Carnets de bords/i })).toBeVisible();

    await appPage.keyboard.press("Control+k");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toBeVisible();
    await expect(appPage.getByRole("dialog", { name: /Carnets de bords/i })).toHaveCount(0);

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toHaveCount(0);

    await openWeeklyPlanPanel(appPage);
    await appPage.keyboard.press("Control+k");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toBeVisible();
    await expect(appPage.getByRole("dialog", { name: /Plan 7 jours/i })).toHaveCount(0);
    await appPage.keyboard.press("Escape");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toHaveCount(0);

    await appPage.getByRole("button", { name: /Ajout rapide/i }).click();
    await expect(appPage.getByRole("dialog", { name: "Ajout rapide" })).toBeVisible();

    await appPage.keyboard.press("Control+k");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toBeVisible();
    await expect(appPage.getByRole("dialog", { name: "Ajout rapide" })).toHaveCount(0);

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByRole("dialog", { name: "Recherche globale" })).toHaveCount(0);
  });

  test("opens quick add panel and filters foods with accent-insensitive search", async ({ appPage }) => {
    const { dialog, searchInput } = await openQuickAddPanel(appPage);

    await searchInput.fill("epinard");
    await expect(dialog.locator(".quick-add-food-option", { hasText: "Épinard" })).toBeVisible();
  });

  test("shows four texture options and defaults to level 1 in quick add and tasting editor", async ({ appPage }) => {
    const foodName = "Banane";

    const { dialog } = await openQuickAddPanel(appPage);

    const quickAddTextureButtons = dialog.locator(".texture-segmented-steps .texture-segmented-btn");
    await expect(quickAddTextureButtons).toHaveCount(4);
    await expect(dialog.locator("#quick-add-1")).toHaveClass(/is-current/);

    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toHaveCount(0);

    const { dialog: searchDialog, searchInput } = await openSearchOverlay(appPage);
    await searchInput.fill("banane");
    await expect(getFirstBiteButton(searchDialog, foodName)).toBeVisible();
    await getFirstBiteButton(searchDialog, foodName).click();

    const editor = getTastingEditor(appPage, foodName, 1);
    await expect(editor).toBeVisible();

    const editorTextureButtons = editor.locator(".texture-segmented-steps .texture-segmented-btn");
    await expect(editorTextureButtons).toHaveCount(4);
    await expect(editor.locator('button[id$="-1"]')).toHaveClass(/is-current/);
  });

  test("resets quick add form fields after close and reopen", async ({ appPage }) => {
    const todayLocalIsoDate = getTodayLocalIsoDate();
    const { dialog, searchInput, dateInput, noteInput, addButton } = await openQuickAddPanel(appPage);

    await searchInput.fill("brocoli");
    await dialog.locator(".quick-add-food-option", { hasText: "Brocoli" }).first().click();
    await dateInput.fill("2026-02-13");
    await dialog.getByRole("button", { name: "Tigre KO" }).click();
    await noteInput.fill("brouillon temporaire");
    await expect(addButton).toBeEnabled();

    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toHaveCount(0);

    const reopenedPanel = await openQuickAddPanel(appPage);
    await expect(reopenedPanel.searchInput).toHaveValue("");
    await expect(reopenedPanel.noteInput).toHaveValue("");
    await expect(reopenedPanel.dateInput).toHaveValue(todayLocalIsoDate);
    await expect(reopenedPanel.dialog.locator("#quick-add-1")).toHaveClass(/is-current/);
    await expect(reopenedPanel.addButton).toBeDisabled();
    await expect(reopenedPanel.dialog.getByText("Sélectionne un aliment existant.")).toBeVisible();
  });

  test("quick add persists default texture level 1 when user does not change texture", async ({ appPage, db }) => {
    const foodName = "Banane";
    const tastedOn = "2026-02-14";

    const { dialog, searchInput, dateInput, addButton } = await openQuickAddPanel(appPage);
    await searchInput.fill("banane");
    await dialog.locator(".quick-add-food-option", { hasText: foodName }).first().click();
    await dateInput.fill(tastedOn);
    await dialog.getByRole("button", { name: "Tigre OK" }).click();
    await addButton.click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.textureLevel ?? 0)
      .toBe(1);
  });

  test("quick add persists indecis as NULL", async ({ appPage, db }) => {
    const foodName = "Banane";
    const { dialog, searchInput, dateInput, addButton } = await openQuickAddPanel(appPage);

    await searchInput.fill(foodName);
    await dialog.locator(".quick-add-food-option", { hasText: foodName }).first().click();
    await dateInput.fill("2026-02-21");
    await dialog.getByRole("button", { name: "Tigre indécis" }).click();
    await addButton.click();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.liked)
      .toBe(null);
  });

  test("quick add rejects non-integer texture level payload", async ({ appPage, db }) => {
    const foodName = "Banane";
    const testedOn = "2026-02-14";

    const { dialog, searchInput, dateInput, addButton } = await openQuickAddPanel(appPage);
    await searchInput.fill("banane");
    await dialog.locator(".quick-add-food-option", { hasText: foodName }).first().click();
    await dateInput.fill(testedOn);
    await dialog.getByRole("button", { name: "Tigre OK" }).click();

    await appPage.evaluate(() => {
      const patchedWindow = window as typeof window & {
        __textureSetOriginal?: (...args: any[]) => void;
      };
      if (!patchedWindow.__textureSetOriginal) {
        patchedWindow.__textureSetOriginal = FormData.prototype.set as (...args: any[]) => void;
      }

      FormData.prototype.set = function patchedSet(...args: any[]) {
        const [name] = args;
        if (name === "textureLevel") {
          return patchedWindow.__textureSetOriginal!.call(this, name, "1.5");
        }
        return patchedWindow.__textureSetOriginal!.apply(this, args);
      };
    });

    try {
      await addButton.click();
      await expect(dialog.getByText("Texture invalide.")).toBeVisible();
    } finally {
      await appPage.evaluate(() => {
        const patchedWindow = window as typeof window & {
          __textureSetOriginal?: (...args: any[]) => void;
        };
        if (patchedWindow.__textureSetOriginal) {
          FormData.prototype.set = patchedWindow.__textureSetOriginal as typeof FormData.prototype.set;
        }
      });
    }

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastingCount ?? 0)
      .toBe(0);
  });

  test("hides foods already at 3/3 in quick add panel", async ({ appPage, db }) => {
    await db.setFoodTastingsByName("Épinard", [
      { slot: 1, liked: true, tastedOn: "2025-02-10" },
      { slot: 2, liked: false, tastedOn: "2025-02-11" },
      { slot: 3, liked: true, tastedOn: "2025-02-12" }
    ]);

    await appPage.reload();

    const { dialog, searchInput } = await openQuickAddPanel(appPage);
    await searchInput.fill("epinard");
    await expect(dialog.locator(".quick-add-food-option", { hasText: "Épinard" })).toHaveCount(0);
    await expect(dialog.getByText("Aucun aliment trouvé.")).toBeVisible();
  });

  test("quick add creates the next slot, appends note, keeps panel open and preserves final preference", async ({
    appPage,
    db
  }) => {
    const foodName = "Brocoli";

    await db.setFoodTastingsByName(
      foodName,
      [{ slot: 1, liked: true, tastedOn: "2025-01-20" }],
      { note: "ancienne note" }
    );
    await db.setFinalPreferenceByName(foodName, 1);
    await appPage.reload();

    const { dialog, searchInput, dateInput, noteInput, addButton } = await openQuickAddPanel(appPage);
    await searchInput.fill("brocoli");
    await dialog.locator(".quick-add-food-option", { hasText: foodName }).first().click();
    await dateInput.fill("2026-02-14");
    await dialog.getByRole("button", { name: /Fondant/i }).click();
    await dialog.getByLabel(/Réaction observée/i).selectOption("2");
    await dialog.getByRole("button", { name: "Tigre KO" }).click();
    await noteInput.fill("nouvelle note");
    await addButton.click();

    await expect(dialog).toBeVisible();
    await expect(searchInput).toHaveValue("");
    await expect(noteInput).toHaveValue("");
    await expect(addButton).toBeDisabled();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastingCount ?? -1)
      .toBe(2);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.map((entry) => entry.slot).join(","))
      .toBe("1,2");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.find((entry) => entry.slot === 2)?.liked)
      .toBe(false);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.find((entry) => entry.slot === 2)?.tastedOn)
      .toBe("2026-02-14");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.note ?? "")
      .toBe("ancienne note");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.find((entry) => entry.slot === 2)?.note ?? "")
      .toBe("nouvelle note");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.find((entry) => entry.slot === 2)?.textureLevel ?? null)
      .toBe(3);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings.find((entry) => entry.slot === 2)?.reactionType ?? null)
      .toBe(2);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.finalPreference ?? 999)
      .toBe(1);
  });

  test("quick add returns a friendly error when food reaches 3/3 before submit", async ({ appPage, db }) => {
    const foodName = "Épinard";

    await db.setFoodTastingsByName(
      foodName,
      [
        { slot: 1, liked: true, tastedOn: "2025-02-11" },
        { slot: 2, liked: true, tastedOn: "2025-02-12" }
      ],
      { note: "note verrouillée" }
    );
    await appPage.reload();

    const { dialog, searchInput, dateInput, noteInput, addButton } = await openQuickAddPanel(appPage);
    await searchInput.fill("epinard");
    await dialog.locator(".quick-add-food-option", { hasText: "Épinard" }).first().click();
    await dateInput.fill("2026-02-14");
    await dialog.getByRole("button", { name: "Tigre KO" }).click();
    await noteInput.fill("ne doit pas passer");

    await db.replaceFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: "2025-02-11" },
      { slot: 2, liked: true, tastedOn: "2025-02-12" },
      { slot: 3, liked: true, tastedOn: "2025-02-13" }
    ]);

    await addButton.click();
    await expect(dialog.getByText("Cet aliment est déjà à 3/3.")).toBeVisible();
    await expect(dialog).toBeVisible();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.note ?? "")
      .toBe("note verrouillée");
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastingCount ?? -1)
      .toBe(3);
  });
});

test.describe("dashboard progression timezone safety", () => {
  test.use({ timezoneId: "Pacific/Kiritimati" });

  test("quick add accepts today's date in a forced client timezone", async ({ appPage, db }) => {
    const foodName = "Banane";
    const { dialog, searchInput, dateInput, addButton } = await openQuickAddPanel(appPage);

    await searchInput.fill("banane");
    await dialog.locator(".quick-add-food-option", { hasText: foodName }).first().click();

    const clientToday = await appPage.evaluate(() => {
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
      return localDate.toISOString().slice(0, 10);
    });

    await dateInput.fill(clientToday);
    await dialog.getByRole("button", { name: "Tigre OK" }).click();
    await addButton.click();

    await expect(dialog.getByText("La date de dégustation ne peut pas être dans le futur.")).toHaveCount(0);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.tastedOn ?? null)
      .toBe(clientToday);
  });
});
