import { expect, test } from "../fixtures/test-fixtures";

test.describe("public share page", () => {
  test("sanitizes snapshot params, renders summary, and tracks valid share id", async ({ page, db }) => {
    const shareId = "share_12345678";
    const firstName = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij0123456789";
    const expectedFirstName = firstName.slice(0, 40);

    const longFoodName = "ÉpinardTrèsTrèsTrèsTrèsTrèsLongNom";
    const expectedFoodName = longFoodName.slice(0, 30);

    const recentFoods = `${longFoodName}|Banane|Pomme|Poire`;

    await page.goto(
      `/share?sid=${shareId}&n=${encodeURIComponent(firstName)}&i=600&t=5&l=-4&m=999&r=${encodeURIComponent(
        recentFoods
      )}`
    );

    await expect(page.getByRole("heading", { name: `Les progres de ${expectedFirstName}` })).toBeVisible();
    await expect(page.getByText("Nouveau palier atteint: 500 aliments")).toBeVisible();

    await expect(page.getByRole("heading", { name: "500" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "100%" })).toBeVisible();

    const recentItems = page.locator(".share-public-recent li");
    await expect(recentItems).toHaveCount(3);
    await expect(recentItems.first()).toHaveText(expectedFoodName);

    await expect
      .poll(async () => {
        const row = await db.queryOne<{ total: number }>(
          `
            SELECT COUNT(*)::int AS total
            FROM growth_events
            WHERE event_name = 'snapshot_link_opened'
              AND metadata->>'shareId' = $1;
          `,
          [shareId]
        );
        return Number(row?.total ?? 0);
      })
      .toBe(1);

    await expect
      .poll(async () => {
        const row = await db.queryOne<{
          introduced_count: string | null;
          total_foods: string | null;
          liked_count: string | null;
          milestone: string | null;
        }>(
          `
            SELECT
              metadata->>'introducedCount' AS introduced_count,
              metadata->>'totalFoods' AS total_foods,
              metadata->>'likedCount' AS liked_count,
              metadata->>'milestone' AS milestone
            FROM growth_events
            WHERE event_name = 'snapshot_link_opened'
              AND metadata->>'shareId' = $1
            ORDER BY id DESC
            LIMIT 1;
          `,
          [shareId]
        );

        return [
          row?.introduced_count || "",
          row?.total_foods || "",
          row?.liked_count || "",
          row?.milestone || ""
        ].join("|");
      })
      .toBe("500|500|0|500");
  });

  test("ignores invalid share id and keeps page accessible", async ({ page, db }) => {
    await page.goto("/share?sid=bad!&n=Louise&i=2&t=7&l=1");

    await expect(page.getByRole("heading", { name: "Les progres de Louise" })).toBeVisible();

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
