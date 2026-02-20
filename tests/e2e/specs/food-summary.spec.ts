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
    await expect(historyRegion.locator('img[src*="smiley-ok.webp"]')).toHaveCount(2);
    await expect(historyRegion.locator('img[src*="smiley-ko.webp"]')).toHaveCount(1);
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
    await expect(historyRegion.getByLabel("Note du 1/3")).toHaveValue("note slot 1");
    await expect(historyRegion.getByLabel("Note du 3/3")).toHaveValue("note slot 3");
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

  test("edits texture and reaction from the summary modal", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await db.setFoodTastingsByName(foodName, [
      { slot: 1, liked: true, tastedOn: "2026-02-07", textureLevel: 1, reactionType: 0 }
    ]);

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Légumes");
    await getFoodSummaryTrigger(appPage, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Texture du 1/3").selectOption("4");
    await dialog.getByLabel("Réaction du 1/3").selectOption("1");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.textureLevel ?? null)
      .toBe(4);
    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.reactionType ?? null)
      .toBe(1);
  });

  test("keeps summary save atomic when one tasting update fails", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    const initialGlobalNote = "note initiale";
    const initialSlot1Note = "slot 1 initial";

    await db.setFoodTastingsByName(
      foodName,
      [
        { slot: 1, liked: true, tastedOn: "2026-02-07", note: initialSlot1Note },
        { slot: 2, liked: false, tastedOn: "2026-02-08", note: "slot 2 initial" }
      ],
      { note: initialGlobalNote }
    );

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Légumes");
    await getFoodSummaryTrigger(appPage, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("note globale modifiée");
    await dialog.getByLabel("Note du 1/3").fill("slot 1 modifié");

    const ownerId = await db.getDefaultOwnerId();
    await db.queryMany(
      `
        DELETE FROM food_tastings
        WHERE owner_id = $1
          AND food_id = (SELECT id FROM foods WHERE name = $2 LIMIT 1)
          AND slot = 2;
      `,
      [ownerId, foodName]
    );

    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog.getByText("Impossible d'enregistrer les notes pour le moment.")).toBeVisible();

    const state = await db.getFoodProgressByName(foodName);
    expect(state?.note ?? "").toBe(initialGlobalNote);
    expect(state?.tastings.find((entry) => entry.slot === 1)?.note ?? "").toBe(initialSlot1Note);
  });

  test("updates the main view after toggling tiger state from summary", async ({ appPage, db }) => {
    const foodName = "Brocoli";
    await db.setFoodTastingsByName(foodName, [{ slot: 1, liked: true, tastedOn: "2026-02-07" }]);

    await appPage.reload();
    await ensureCategoryExpanded(appPage, "Légumes");
    await getFoodSummaryTrigger(appPage, foodName).click();

    const dialog = getFoodSummaryDialog(appPage, foodName);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /Basculer le résultat du tigre 1\/3/i }).click();
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => (await db.getFoodProgressByName(foodName))?.tastings?.[0]?.liked ?? null)
      .toBe(false);

    await expect(
      appPage.getByRole("button", {
        name: new RegExp(`^${escapeRegExp(foodName)} - entrée 1 \\(pas aimé`, "i")
      })
    ).toBeVisible();
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

  test("timeline lines keep fixed 10ch name column and aligned badges", async ({ appPage, db }) => {
    const finalFoodName = "Brocoli";
    const nonFinalFoodName = "Épinard";

    await db.setFoodTastingsByName(finalFoodName, [
      { slot: 1, liked: true, tastedOn: "2026-02-08", note: "premier test" },
      { slot: 2, liked: false, tastedOn: "2026-02-09", note: "" },
      { slot: 3, liked: true, tastedOn: "2026-02-10", note: "note finale alignée" }
    ]);
    await db.setFoodTastingsByName(nonFinalFoodName, [
      {
        slot: 1,
        liked: false,
        tastedOn: "2026-02-10",
        note: "note en cours pour valider l'alignement"
      }
    ]);

    await appPage.reload();
    const timeline = await openTimelineOverlay(appPage);
    const dialog = timeline.dialog;

    await expect(dialog.locator(".food-timeline-rail-dot")).toHaveCount(0);

    const finalEntry = dialog.locator('.food-timeline-entry:has(.slot-3):has-text("Brocoli")').first();
    const nonFinalEntry = dialog.locator('.food-timeline-entry:has(.slot-1):has-text("Épinard")').first();
    await expect(finalEntry).toBeVisible();
    await expect(nonFinalEntry).toBeVisible();
    await expect(finalEntry.getByRole("button", { name: `Ouvrir le résumé de ${finalFoodName}` })).toBeVisible();
    await expect(nonFinalEntry.getByRole("button", { name: `Ouvrir le résumé de ${nonFinalFoodName}` })).toBeVisible();
    await expect(dialog.locator(".food-timeline-content")).toHaveCount(1);

    const hasTimelineOverflowX = await dialog.locator(".food-timeline-content").evaluate((element) => {
      return element.scrollWidth > element.clientWidth + 1;
    });
    expect(hasTimelineOverflowX).toBe(false);

    const finalResult = finalEntry.locator(".food-timeline-cell--result.food-timeline-result-inline");
    await expect(finalResult).toHaveCount(1);
    await expect(finalResult).toHaveAttribute("aria-label", /Résultat final/i);
    await expect(finalEntry.locator(".food-timeline-result-inline--placeholder")).toHaveCount(0);

    const nonFinalPlaceholder = nonFinalEntry.locator(".food-timeline-result-inline--placeholder");
    await expect(nonFinalPlaceholder).toHaveCount(1);
    await expect(nonFinalPlaceholder).toHaveAttribute("aria-hidden", "true");
    await expect(nonFinalEntry.getByRole("button", { name: `Ouvrir le résumé de ${nonFinalFoodName}` })).toHaveCount(1);

    const placeholderVisibility = await nonFinalPlaceholder.evaluate((element) => getComputedStyle(element).visibility);
    expect(placeholderVisibility).toBe("hidden");

    const finalCellOrder = await finalEntry.locator(".food-timeline-one-liner").evaluate((node) =>
      Array.from(node.children).map((child) =>
        Array.from(child.classList).find((name) => name.startsWith("food-timeline-cell--")) ?? ""
      )
    );

    expect(finalCellOrder.slice(0, 6)).toEqual([
      "food-timeline-cell--category",
      "food-timeline-cell--name",
      "food-timeline-cell--slot",
      "food-timeline-cell--texture",
      "food-timeline-cell--reaction",
      "food-timeline-cell--result"
    ]);
    expect(finalCellOrder[6]).toBe("food-timeline-cell--note");

    const finalNote = finalEntry.locator(".food-timeline-note-inline");
    const nonFinalNote = nonFinalEntry.locator(".food-timeline-note-inline");
    await expect(finalNote).toHaveCount(1);
    await expect(nonFinalNote).toHaveCount(1);
    await expect(
      nonFinalEntry.locator('.food-timeline-cell--texture img[src*="texture-0-aucune.webp"]')
    ).toHaveCount(1);
    await expect(dialog.locator("text=ø")).toHaveCount(0);

    const [finalBadgePositions, nonFinalBadgePositions] = await Promise.all([
      finalEntry.evaluate((entryNode) => {
        const slot = entryNode.querySelector<HTMLElement>(".food-timeline-cell--slot");
        const texture = entryNode.querySelector<HTMLElement>(".food-timeline-cell--texture");
        const reaction = entryNode.querySelector<HTMLElement>(".food-timeline-cell--reaction");
        const result = entryNode.querySelector<HTMLElement>(".food-timeline-cell--result");
        return {
          slotLeft: slot?.getBoundingClientRect().left ?? 0,
          textureLeft: texture?.getBoundingClientRect().left ?? 0,
          reactionLeft: reaction?.getBoundingClientRect().left ?? 0,
          resultLeft: result?.getBoundingClientRect().left ?? 0
        };
      }),
      nonFinalEntry.evaluate((entryNode) => {
        const slot = entryNode.querySelector<HTMLElement>(".food-timeline-cell--slot");
        const texture = entryNode.querySelector<HTMLElement>(".food-timeline-cell--texture");
        const reaction = entryNode.querySelector<HTMLElement>(".food-timeline-cell--reaction");
        const result = entryNode.querySelector<HTMLElement>(".food-timeline-cell--result");
        return {
          slotLeft: slot?.getBoundingClientRect().left ?? 0,
          textureLeft: texture?.getBoundingClientRect().left ?? 0,
          reactionLeft: reaction?.getBoundingClientRect().left ?? 0,
          resultLeft: result?.getBoundingClientRect().left ?? 0
        };
      })
    ]);

    expect(Math.abs(finalBadgePositions.slotLeft - nonFinalBadgePositions.slotLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(finalBadgePositions.textureLeft - nonFinalBadgePositions.textureLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(finalBadgePositions.reactionLeft - nonFinalBadgePositions.reactionLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(finalBadgePositions.resultLeft - nonFinalBadgePositions.resultLeft)).toBeLessThanOrEqual(2);

    const nonFinalNoteStyle = await nonFinalNote.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        whiteSpace: style.whiteSpace,
        overflowX: style.overflowX,
        textOverflow: style.textOverflow,
        maxWidth: style.maxWidth
      };
    });

    expect(nonFinalNoteStyle.whiteSpace).toBe("nowrap");
    expect(nonFinalNoteStyle.overflowX).toBe("hidden");
    expect(nonFinalNoteStyle.textOverflow).toBe("ellipsis");
    expect(nonFinalNoteStyle.maxWidth).not.toBe("none");

    const [finalNameStyle, nonFinalNameStyle] = await Promise.all([
      finalEntry.getByRole("button", { name: `Ouvrir le résumé de ${finalFoodName}` }).evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          measuredWidth: element.getBoundingClientRect().width,
          whiteSpace: style.whiteSpace,
          overflowX: style.overflowX,
          textOverflow: style.textOverflow
        };
      }),
      nonFinalEntry.getByRole("button", { name: `Ouvrir le résumé de ${nonFinalFoodName}` }).evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          measuredWidth: element.getBoundingClientRect().width,
          whiteSpace: style.whiteSpace,
          overflowX: style.overflowX,
          textOverflow: style.textOverflow
        };
      })
    ]);

    expect(nonFinalNameStyle.whiteSpace).toBe("nowrap");
    expect(nonFinalNameStyle.overflowX).toBe("hidden");
    expect(nonFinalNameStyle.textOverflow).toBe("ellipsis");
    expect(nonFinalNameStyle.minWidth).toBe(nonFinalNameStyle.maxWidth);
    expect(finalNameStyle.minWidth).toBe(finalNameStyle.maxWidth);
    expect(Math.abs(finalNameStyle.measuredWidth - nonFinalNameStyle.measuredWidth)).toBeLessThanOrEqual(1);

    const hasEntryOverflowX = await nonFinalEntry.evaluate((element) => {
      return element.scrollWidth > element.clientWidth + 1;
    });
    expect(hasEntryOverflowX).toBe(false);

    await appPage.setViewportSize({ width: 390, height: 844 });
    await appPage.reload();

    const mobileTimeline = await openTimelineOverlay(appPage);
    const mobileDialog = mobileTimeline.dialog;
    const mobileNonFinalEntry = mobileDialog.locator('.food-timeline-entry:has(.slot-1):has-text("Épinard")').first();

    await expect(mobileNonFinalEntry).toBeVisible();

    const mobileLineBreak = await mobileNonFinalEntry.evaluate((entryNode) => {
      const note = entryNode.querySelector<HTMLElement>(".food-timeline-cell--note");
      const rowOneSelectors = [
        ".food-timeline-cell--category",
        ".food-timeline-cell--name",
        ".food-timeline-cell--slot",
        ".food-timeline-cell--texture",
        ".food-timeline-cell--reaction",
        ".food-timeline-cell--result"
      ];

      const rowOneBottom = Math.max(
        ...rowOneSelectors.map((selector) => {
          const element = entryNode.querySelector<HTMLElement>(selector);
          return element ? element.getBoundingClientRect().bottom : 0;
        })
      );

      return {
        noteTop: note?.getBoundingClientRect().top ?? 0,
        rowOneBottom
      };
    });

    expect(mobileLineBreak.noteTop).toBeGreaterThan(mobileLineBreak.rowOneBottom - 1);

    const hasMobileTimelineOverflowX = await mobileDialog.locator(".food-timeline-content").evaluate((element) => {
      return element.scrollWidth > element.clientWidth + 1;
    });
    expect(hasMobileTimelineOverflowX).toBe(false);

    const hasMobileEntryOverflowX = await mobileNonFinalEntry.evaluate((element) => {
      return element.scrollWidth > element.clientWidth + 1;
    });
    expect(hasMobileEntryOverflowX).toBe(false);
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
