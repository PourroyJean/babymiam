import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

function getTomorrowIsoDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
    await appPage.getByRole("button", { name: "Profil" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Profil enfant" });
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
    await appPage.getByRole("button", { name: "Profil" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Profil enfant" });
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

    await appPage.getByRole("button", { name: "Profil" }).click();
    const reopenedDialog = appPage.getByRole("dialog", { name: "Profil enfant" });
    await expect(reopenedDialog.getByLabel("Prénom")).toHaveValue("Louise");
    await expect(reopenedDialog.getByLabel("Date de naissance")).toHaveValue("2024-02-15");
  });

  test("shares recap through clipboard and stores growth events", async ({ appPage, db }) => {
    await db.upsertFoodProgressByName("Épinard", {
      exposureCount: 1,
      preference: 1,
      firstTastedOn: "2025-01-10",
      note: ""
    });
    await db.upsertFoodProgressByName("Carotte", {
      exposureCount: 1,
      preference: 1,
      note: ""
    });
    await db.upsertFoodProgressByName("Banane", {
      exposureCount: 1,
      preference: 0,
      note: ""
    });

    await setupClipboardMock(appPage);
    await appPage.reload();

    await appPage.getByRole("button", { name: "Profil" }).click();
    const dialog = appPage.getByRole("dialog", { name: "Profil enfant" });

    await dialog.getByRole("button", { name: "Partager les progrès" }).click();
    await expect(dialog.getByText("Récap copié.")).toBeVisible();

    const copiedTexts = await appPage.evaluate(() => {
      const windowWithClipboard = window as Window & { __e2eCopiedTexts?: string[] };
      return windowWithClipboard.__e2eCopiedTexts || [];
    });
    expect(copiedTexts.length).toBeGreaterThan(0);
    expect(copiedTexts[copiedTexts.length - 1]).toContain("Voir le récap:");

    await expect
      .poll(async () => {
        const events = await db.getGrowthEvents();
        return events
          .filter((event) =>
            ["snapshot_link_created", "share_clicked", "share_success"].includes(event.eventName)
          )
          .map((event) => `${event.eventName}:${event.channel}`)
          .join(",");
      })
      .toContain("snapshot_link_created:snapshot");

    await expect
      .poll(async () => {
        const events = await db.getGrowthEvents("share_success");
        const latest = events[events.length - 1];
        return String(latest?.metadata?.shareId || "");
      })
      .toMatch(/^[a-zA-Z0-9_-]{8,80}$/);
  });

  test("shares unlocked milestone and tracks dedicated milestone events", async ({ appPage, db }) => {
    await db.setIntroducedFoods(10);

    await setupClipboardMock(appPage);
    await appPage.reload();

    await appPage.getByRole("button", { name: "Profil" }).click();
    const dialog = appPage.getByRole("dialog", { name: "Profil enfant" });

    const milestoneButton = dialog.getByRole("button", {
      name: "Partager le palier 10 aliments"
    });
    await expect(milestoneButton).toBeEnabled();

    await milestoneButton.click();

    await expect(dialog.getByText("Palier 10 copié.")).toBeVisible();

    await expect
      .poll(async () => {
        const clicked = await db.getGrowthEvents("milestone_share_clicked");
        const success = await db.getGrowthEvents("milestone_share_success");
        return `${clicked.length}|${success.length}`;
      })
      .toBe("1|1");

    await expect
      .poll(async () => {
        const success = await db.getGrowthEvents("milestone_share_success");
        const latest = success[success.length - 1];
        return String(latest?.metadata?.milestone || "");
      })
      .toBe("10");
  });
});
