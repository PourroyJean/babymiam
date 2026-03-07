import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function getTomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function setupClipboardMock(page: Page) {
  await page.addInitScript(() => {
    const copiedTexts: string[] = [];

    Object.defineProperty(window, "__e2eCopiedTexts", {
      value: copiedTexts,
      configurable: true
    });

    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true
    });

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          copiedTexts.push(value);
        }
      },
      configurable: true
    });
  });
}

test.describe("profile and share", () => {
  test("blocks save when profile inputs are invalid", async ({ appPage }) => {
    await appPage.getByRole("button", { name: "Mon compte" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Mon compte" });
    await expect(dialog).toBeVisible();

    const firstNameInput = dialog.getByLabel("Prénom");
    const birthDateInput = dialog.getByLabel("Date de naissance");
    const saveButton = dialog.getByRole("button", { name: "Enregistrer" });

    await firstNameInput.fill("");
    await birthDateInput.fill("2024-03-01");
    await expect(saveButton).toBeDisabled();

    await firstNameInput.fill("Louise");
    await birthDateInput.fill(getTomorrowIsoDate());
    await expect(saveButton).toBeDisabled();
  });

  test("saves child profile and persists values", async ({ appPage, db }) => {
    await appPage.getByRole("button", { name: "Mon compte" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Mon compte" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Prénom").fill("Louise");
    await dialog.getByLabel("Date de naissance").fill("2024-02-15");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => {
        const ownerId = await db.getDefaultOwnerId();
        const row = await db.queryOne<{ first_name: string; birth_date: string }>(
          `
            SELECT first_name, birth_date::text AS birth_date
            FROM child_profiles
            WHERE owner_id = $1;
          `,
          [ownerId]
        );

        if (!row) return null;
        return `${row.first_name}|${row.birth_date}`;
      })
      .toBe("Louise|2024-02-15");

    await appPage.getByRole("button", { name: "Mon compte" }).click();
    const reopenedDialog = appPage.getByRole("dialog", { name: "Mon compte" });
    await expect(reopenedDialog.getByLabel("Prénom")).toHaveValue("Louise");
    await expect(reopenedDialog.getByLabel("Date de naissance")).toHaveValue("2024-02-15");
  });

  test("generates and copies a live public share link from the account modal", async ({ appPage, db }) => {
    await db.setFoodTastingsByName(
      "Épinard",
      [
        { slot: 1, liked: true, tastedOn: "2025-01-10" },
        { slot: 2, liked: true, tastedOn: "2025-01-11" },
        { slot: 3, liked: false, tastedOn: "2025-01-12" }
      ],
      { finalPreference: 1 }
    );
    await db.setFoodTastingsByName(
      "Carotte",
      [
        { slot: 1, liked: true, tastedOn: "2025-01-05" },
        { slot: 2, liked: true, tastedOn: "2025-01-06" },
        { slot: 3, liked: true, tastedOn: "2025-01-07" }
      ],
      { finalPreference: 1 }
    );
    await db.setFoodTastingsByName("Banane", [{ slot: 1, liked: true, tastedOn: "2025-01-09" }]);

    await setupClipboardMock(appPage);
    await appPage.reload();

    await appPage.getByRole("button", { name: "Mon compte" }).click();
    const dialog = appPage.getByRole("dialog", { name: "Mon compte" });

    await expect(dialog.getByRole("button", { name: "Partager les progrès" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Partager le palier/i })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Générer un lien" }).click();
    await expect(dialog.getByText("Lien public généré.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Copier le lien" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Régénérer" })).toBeVisible();

    await dialog.getByRole("button", { name: "Copier le lien" }).click();
    await expect(dialog.getByText("Lien copié.")).toBeVisible();

    const copiedTexts = await appPage.evaluate(() => {
      const windowWithClipboard = window as Window & { __e2eCopiedTexts?: string[] };
      return windowWithClipboard.__e2eCopiedTexts || [];
    });
    expect(copiedTexts.length).toBeGreaterThan(0);
    expect(copiedTexts[copiedTexts.length - 1]).toContain("/share/");

    await expect
      .poll(async () => {
        const ownerId = await db.getDefaultOwnerId();
        const row = await db.queryOne<{ public_id: string; expires_at: string }>(
          `
            SELECT public_id, expires_at::text AS expires_at
            FROM public_share_links
            WHERE owner_id = $1
            LIMIT 1;
          `,
          [ownerId]
        );
        if (!row) return null;
        return `${row.public_id}|${row.expires_at ? "1" : "0"}`;
      })
      .toMatch(/^[A-Za-z0-9_-]{16,128}\|1$/);
  });

  test("regenerates the public share link and invalidates the previous one immediately", async ({
    appPage,
    browser
  }) => {
    await setupClipboardMock(appPage);
    await appPage.goto("/account");

    await appPage.getByRole("button", { name: "Mon compte" }).click();
    const dialog = appPage.getByRole("dialog", { name: "Mon compte" });

    await dialog.getByRole("button", { name: "Générer un lien" }).click();
    await expect(dialog.getByText("Lien public généré.")).toBeVisible();
    await dialog.getByRole("button", { name: "Copier le lien" }).click();

    const firstCopiedTexts = await appPage.evaluate(() => {
      const windowWithClipboard = window as Window & { __e2eCopiedTexts?: string[] };
      return windowWithClipboard.__e2eCopiedTexts || [];
    });
    const firstUrl = firstCopiedTexts[firstCopiedTexts.length - 1];
    expect(firstUrl).toContain("/share/");

    await dialog.getByRole("button", { name: "Régénérer" }).click();
    await expect(dialog.getByText("Lien public régénéré.")).toBeVisible();
    await dialog.getByRole("button", { name: "Copier le lien" }).click();

    const secondCopiedTexts = await appPage.evaluate(() => {
      const windowWithClipboard = window as Window & { __e2eCopiedTexts?: string[] };
      return windowWithClipboard.__e2eCopiedTexts || [];
    });
    const secondUrl = secondCopiedTexts[secondCopiedTexts.length - 1];
    expect(secondUrl).toContain("/share/");
    expect(secondUrl).not.toBe(firstUrl);

    const oldPage = await browser.newPage();
    await oldPage.goto(firstUrl);
    await expect(oldPage.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();
    await oldPage.close();

    const freshPage = await browser.newPage();
    await freshPage.goto(secondUrl);
    await expect(freshPage.getByRole("heading", { name: /Les progrès|Progression diversification/i })).toBeVisible();
    await freshPage.close();
  });
});
