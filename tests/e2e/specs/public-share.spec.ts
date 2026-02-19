import { expect, test } from "../fixtures/test-fixtures";

test.describe("public share page", () => {
  test("renders persisted snapshot data and tracks public open events", async ({ page, db }) => {
    const shareId = "share_12345678";

    await db.createShareSnapshot({
      shareId,
      firstName: "Louise",
      introducedCount: 12,
      totalFoods: 25,
      likedCount: 8,
      milestone: 10,
      recentFoods: ["Épinard", "Banane", "Pomme"]
    });

    await page.goto(`/share?sid=${shareId}`);

    await expect(page.getByRole("heading", { name: "Les progres de Louise" })).toBeVisible();
    await expect(page.getByText("Nouveau palier atteint: 10 aliments")).toBeVisible();

    await expect(page.getByRole("heading", { name: "12" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "48%" })).toBeVisible();

    const recentItems = page.locator(".share-public-recent li");
    await expect(recentItems).toHaveCount(3);
    await expect(recentItems.first()).toHaveText("Épinard");

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ total: number }>(
          `
            SELECT COUNT(*)::int AS total
            FROM growth_events
            WHERE event_name = 'snapshot_link_opened'
              AND visibility = 'public'
              AND metadata->>'shareId' = $1;
          `,
          [shareId]
        );
        return Number(row?.total ?? 0);
      })
      .toBe(1);

    await page.goto(`/share?sid=${shareId}`);

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ total: number }>(
          `
            SELECT COUNT(*)::int AS total
            FROM growth_events
            WHERE event_name = 'snapshot_link_opened'
              AND visibility = 'public'
              AND metadata->>'shareId' = $1;
          `,
          [shareId]
        );
        return Number(row?.total ?? 0);
      })
      .toBe(1);
  });

  test("returns unavailable state for invalid share id", async ({ page, db }) => {
    await page.goto("/share?sid=bad!");

    await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ total: number }>(
          `
            SELECT COUNT(*)::int AS total
            FROM growth_events
            WHERE event_name = 'snapshot_link_opened';
          `
        );
        return Number(row?.total ?? 0);
      })
      .toBe(0);
  });
});
