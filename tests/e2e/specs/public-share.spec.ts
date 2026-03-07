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
      { finalPreference: 0 }
    );
    await db.setFoodTastingsByName(
      "Brocoli",
      [
        { slot: 1, liked: false, tastedOn: "2025-01-13" },
        { slot: 2, liked: false, tastedOn: "2025-01-14" },
        { slot: 3, liked: false, tastedOn: "2025-01-15" }
      ],
      { finalPreference: -1 }
    );
    await db.setFoodTastingsByName("Banane", [{ slot: 1, liked: true, tastedOn: "2025-01-09" }]);

    const shareLink = await db.createPublicShareLink({});

    await page.goto(shareLink.url);

    const testedCard = page.locator(".public-share-kpi-card-primary");
    const reactionsPanel = page.getByRole("region", { name: /Comment .* réagit/i });

    await expect(page.getByRole("heading", { name: /Les progrès/i })).toBeVisible();
    await expect(testedCard.getByText("Aliments testés")).toBeVisible();
    await expect(testedCard.getByText(/^4\/\d+$/)).toBeVisible();
    await expect(page.getByText("Aliments validés")).toHaveCount(0);
    await expect(reactionsPanel.getByText("Préférences finales")).toBeVisible();
    await expect(reactionsPanel.getByRole("heading", { name: /Comment .* réagit/i })).toBeVisible();
    await expect(reactionsPanel.locator(".public-share-donut-center strong")).toHaveText("3");
    await expect(
      reactionsPanel.getByRole("img", { name: "3 aliments validés: 1 aimés, 1 neutres, 1 pas aimés." })
    ).toBeVisible();
    await expect(reactionsPanel.locator(".public-share-donut-legend li").nth(0)).toContainText("Aimés");
    await expect(reactionsPanel.locator(".public-share-donut-legend li").nth(0)).toContainText("1");
    await expect(reactionsPanel.locator(".public-share-donut-legend li").nth(1)).toContainText("Neutres");
    await expect(reactionsPanel.locator(".public-share-donut-legend li").nth(1)).toContainText("1");
    await expect(reactionsPanel.locator(".public-share-donut-legend li").nth(2)).toContainText("Pas aimés");
    await expect(reactionsPanel.locator(".public-share-donut-legend li").nth(2)).toContainText("1");
    await expect(page.getByText("Découvertes par catégorie")).toBeVisible();
    await expect(page.getByText(/10 dégustations cumulées/i)).toBeVisible();
    await expect(page.getByRole("img", { name: "Courbe cumulative des dégustations, total final 10." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Carnet de bord/i })).toBeVisible();
    await expect(page.getByText("Très bonne texture.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Carnets de bords" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Légumes/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Ouvrir le résumé|Ouvrir le détail/i })).toHaveCount(0);
    await expect
      .poll(async () => {
        const pathD = await page.locator(".public-share-line-path").getAttribute("d");
        if (!pathD) return null;
        const startY = Number(pathD.match(/^M [0-9.]+ ([0-9.]+)/)?.[1] ?? Number.NaN);
        const verticalMoves = [...pathD.matchAll(/V ([0-9.]+)/g)].map((match) => Number(match[1]));
        const yValues = [startY, ...verticalMoves];
        return yValues.every((value, index) => index === 0 || value <= yValues[index - 1]);
      })
      .toBe(true);

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

    await expect
      .poll(async () => {
        const row = await db.queryOne<{
          introduced_count: number;
          completed_count: number;
          liked_count: number;
          neutral_count: number;
          disliked_count: number;
          total_tastings: number;
        }>(
          `
            SELECT
              (metadata->>'introducedCount')::int AS introduced_count,
              (metadata->>'completedCount')::int AS completed_count,
              (metadata->>'likedCount')::int AS liked_count,
              (metadata->>'neutralCount')::int AS neutral_count,
              (metadata->>'dislikedCount')::int AS disliked_count,
              (metadata->>'totalTastings')::int AS total_tastings
            FROM growth_events
            WHERE event_name = 'public_share_link_opened'
              AND visibility = 'public'
              AND metadata->>'publicId' = $1
            ORDER BY created_at DESC
            LIMIT 1;
          `,
          [shareLink.publicId]
        );

        return row
          ? {
              introducedCount: Number(row.introduced_count),
              completedCount: Number(row.completed_count),
              likedCount: Number(row.liked_count),
              neutralCount: Number(row.neutral_count),
              dislikedCount: Number(row.disliked_count),
              totalTastings: Number(row.total_tastings)
            }
          : null;
      })
      .toMatchObject({
        introducedCount: 4,
        completedCount: 3,
        likedCount: 1,
        neutralCount: 1,
        dislikedCount: 1,
        totalTastings: 10
      });

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
    await expect(page.locator(".public-share-kpi-card-primary").getByText(/^0\/\d+$/)).toBeVisible();
    await expect(page.getByText("Aucun aliment validé pour le moment.")).toHaveCount(1);
    await expect(page.getByText("Aucune dégustation enregistrée pour le moment.")).toHaveCount(1);

    await db.setFoodTastingsByName("Banane", [{ slot: 1, liked: true, tastedOn: "2025-01-09" }]);

    await page.goto(shareLink.url);
    await expect(page.locator(".public-share-kpi-card-primary").getByText(/^1\/\d+$/)).toBeVisible();
    await expect(page.getByText("Aucun aliment validé pour le moment.")).toHaveCount(1);
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
