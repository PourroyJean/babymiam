import { expect, test } from "../fixtures/test-fixtures";

test.describe("public share page", () => {
  test("renders live dashboard data and tracks public opens", async ({ page, db }) => {
    await db.setFoodTastingsByName(
      "Épinard",
      [
        { slot: 1, liked: true, tastedOn: "2025-01-10", note: "Très bonne texture." },
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

    const shareLink = await db.createPublicShareLink({});

    await page.goto(shareLink.url);

    await expect(page.getByRole("heading", { name: /Les progrès|Progression diversification/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "12%" })).toBeVisible();
    await expect(page.getByText("Derniers essais")).toBeVisible();
    await expect(page.getByRole("button", { name: "Carnets de bords" })).toBeVisible();

    await page.getByRole("button", { name: /Légumes/i }).click();
    await page.getByRole("button", { name: "Voir le détail de Épinard" }).click();
    await expect(page.getByRole("dialog", { name: "Épinard" })).toBeVisible();
    await expect(page.getByText("Très bonne texture.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mettre à jour" })).toHaveCount(0);
    await page.getByRole("button", { name: "Fermer" }).click();

    await page.getByRole("button", { name: "Carnets de bords" }).click();
    await expect(page.getByRole("dialog", { name: /Carnets de bords/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ouvrir le détail de Épinard, essai 3" })).toBeVisible();
    await page.getByRole("button", { name: "Fermer le carnet de bord" }).click();

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ total: number }>(
          `
            SELECT COUNT(*)::int AS total
            FROM growth_events
            WHERE event_name = 'public_share_link_opened'
              AND visibility = 'public'
              AND metadata->>'publicId' = $1;
          `,
          [shareLink.publicId]
        );
        return Number(row?.total ?? 0);
      })
      .toBe(1);

    await page.goto(shareLink.url);

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ total: number }>(
          `
            SELECT COUNT(*)::int AS total
            FROM growth_events
            WHERE event_name = 'public_share_link_opened'
              AND visibility = 'public'
              AND metadata->>'publicId' = $1;
          `,
          [shareLink.publicId]
        );
        return Number(row?.total ?? 0);
      })
      .toBe(1);
  });

  test("reflects live diversification changes made after the link was created", async ({ page, db }) => {
    const shareLink = await db.createPublicShareLink({});

    await page.goto(shareLink.url);
    await expect(page.getByRole("heading", { name: "0" }).first()).toBeVisible();

    await db.setFoodTastingsByName("Banane", [{ slot: 1, liked: true, tastedOn: "2025-01-09" }]);

    await page.goto(shareLink.url);
    await expect(page.getByRole("heading", { name: "1" }).first()).toBeVisible();
    await expect(page.getByText("Banane")).toBeVisible();
  });

  test("returns unavailable state for expired or invalid links", async ({ page, db }) => {
    const expiredLink = await db.createPublicShareLink({
      issuedAtEpochSeconds: Math.floor(Date.now() / 1000) - 181 * 24 * 60 * 60,
      expiresAtEpochSeconds: Math.floor(Date.now() / 1000) - 60
    });

    await page.goto(expiredLink.url);
    await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();

    await page.goto("/share/invalid");
    await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();

    await page.goto("/share?sid=bad!");
    await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();
  });
});
