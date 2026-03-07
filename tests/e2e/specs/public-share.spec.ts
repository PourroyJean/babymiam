import { expect, test } from "../fixtures/test-fixtures";

test.describe("public share page", () => {
  test("keeps long timeline cards readable across breakpoints", async ({ page, db }) => {
    await db.setFoodTastingsByName(
      "Céréales contenant du gluten",
      [
        {
          slot: 2,
          liked: true,
          tastedOn: "2026-03-07",
          note: "Très bonne texture, bien toléré et facile à proposer au déjeuner."
        }
      ]
    );
    await db.setFoodTastingsByName(
      "Anhydride sulfureux et sulfites",
      [
        {
          slot: 3,
          liked: false,
          tastedOn: "2026-03-07",
          note: "Réaction légère observée après une portion plus importante que d'habitude."
        }
      ],
      { finalPreference: -1 }
    );

    const shareLink = await db.createPublicShareLink({});

    const timelineLayoutLooksGood = async (isMobile: boolean) =>
      page.evaluate((mobileLayout) =>
        [...document.querySelectorAll<HTMLElement>(".public-share-timeline-body .food-timeline-card")].every((card) => {
          const name = card.querySelector<HTMLElement>(".food-timeline-food-name-inline");
          const note = card.querySelector<HTMLElement>(".food-timeline-note-inline");
          const slot = card.querySelector<HTMLElement>(".food-timeline-cell--slot");

          if (!name || !note) return false;

          const cardRect = card.getBoundingClientRect();
          const noteRect = note.getBoundingClientRect();
          const slotRect = slot?.getBoundingClientRect() ?? null;
          const cardFitsHorizontally = card.scrollWidth <= card.clientWidth + 1;
          const nameFits = name.scrollWidth <= name.clientWidth + 1;
          const noteFitsCard = noteRect.right <= cardRect.right + 1;

          if (!mobileLayout || !slotRect) {
            return cardFitsHorizontally && nameFits && noteFitsCard;
          }

          const noteSharesRowWithBadge = Math.abs(noteRect.top - slotRect.top) <= 2;
          const noteStartsAfterBadge = noteRect.left >= slotRect.right + 4;
          const noteUsesRemainingWidth = cardRect.right - noteRect.right <= 14;

          return (
            cardFitsHorizontally &&
            nameFits &&
            noteFitsCard &&
            noteSharesRowWithBadge &&
            noteStartsAfterBadge &&
            noteUsesRemainingWidth
          );
        })
      , isMobile);

    await page.goto(shareLink.url);
    await expect(page.getByText("Céréales contenant du gluten")).toBeVisible();
    await expect(page.getByText("Anhydride sulfureux et sulfites")).toBeVisible();
    await expect.poll(() => timelineLayoutLooksGood(false)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText("Céréales contenant du gluten")).toBeVisible();
    await expect(page.getByText("Anhydride sulfureux et sulfites")).toBeVisible();
    await expect.poll(() => timelineLayoutLooksGood(true)).toBe(true);
  });

  test("uses the compact evolution title on mobile", async ({ page, db }) => {
    await db.setFoodTastingsByName(
      "Carotte",
      [
        { slot: 1, liked: true, tastedOn: "2026-01-03" },
        { slot: 2, liked: true, tastedOn: "2026-01-10" }
      ]
    );
    await db.setFoodTastingsByName("Banane", [{ slot: 1, liked: true, tastedOn: "2026-03-07" }]);

    const shareLink = await db.createPublicShareLink({});

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(shareLink.url);

    const chartHeader = page.locator(".public-share-panel-chart .public-share-section-head");
    const compactTitle = page.getByRole("heading", { name: "Depuis le 03/01/2026 : 3 dégustations" });

    await expect(compactTitle).toBeVisible();
    await expect
      .poll(async () => compactTitle.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
      .toBe(true);
    await expect(chartHeader.locator(".public-share-chart-heading-desktop")).toBeHidden();
    await expect(chartHeader.locator(".public-share-chart-summary--desktop")).toBeHidden();
  });

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
    await reactionsPanel.getByRole("button", { name: /^Aimés\b/i }).click();
    const likedDialog = page.getByRole("dialog", { name: "Aimés" });
    await expect(likedDialog).toBeVisible();
    await expect(likedDialog.getByText("Épinard")).toBeVisible();
    await expect(likedDialog.getByText("Carotte")).toHaveCount(0);
    await likedDialog.getByRole("button", { name: /Fermer/i }).click();
    await expect(likedDialog).toHaveCount(0);

    await reactionsPanel.getByRole("button", { name: /Neutres/i }).click();
    const neutralDialog = page.getByRole("dialog", { name: "Neutres" });
    await expect(neutralDialog).toBeVisible();
    await expect(neutralDialog.getByText("Carotte")).toBeVisible();
    await neutralDialog.getByRole("button", { name: /Fermer/i }).click();
    await expect(neutralDialog).toHaveCount(0);

    await reactionsPanel.getByRole("button", { name: /^Pas aimés\b/i }).click();
    const dislikedDialog = page.getByRole("dialog", { name: "Pas aimés" });
    await expect(dislikedDialog).toBeVisible();
    await expect(dislikedDialog.getByText("Brocoli")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dislikedDialog).toHaveCount(0);
    await expect(page.getByText("Découvertes par catégorie")).toBeVisible();
    await page.getByRole("button", { name: /Légumes/i }).click();
    const vegetablesDialog = page.getByRole("dialog", { name: "Légumes" });
    await expect(vegetablesDialog).toBeVisible();
    await expect(vegetablesDialog.getByText("Épinard")).toBeVisible();
    await expect(vegetablesDialog.getByText("Carotte")).toBeVisible();
    await expect(vegetablesDialog.getByText("Brocoli")).toBeVisible();
    await expect(vegetablesDialog.getByText("Banane")).toHaveCount(0);
    await expect(vegetablesDialog.locator("li", { hasText: "Épinard" })).toHaveClass(/public-share-preference-list-item--liked/);
    await expect(vegetablesDialog.locator("li", { hasText: "Carotte" })).toHaveClass(/public-share-preference-list-item--neutral/);
    await expect(vegetablesDialog.locator("li", { hasText: "Brocoli" })).toHaveClass(/public-share-preference-list-item--disliked/);
    await vegetablesDialog.getByRole("button", { name: /Fermer/i }).click();
    await expect(vegetablesDialog).toHaveCount(0);
    await expect(page.getByText(/10 dégustations cumulées/i)).toBeVisible();
    await expect(page.getByRole("img", { name: "Courbe cumulative des dégustations, total final 10." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Carnet de bord/i })).toBeVisible();
    await expect(page.getByText("Très bonne texture.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Carnets de bords" })).toHaveCount(0);
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

  test("returns unavailable state when the owner is inactive or no longer verified", async ({ page, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    const shareLink = await db.createPublicShareLink({});

    await db.queryMany(
      `
        UPDATE users
        SET status = 'inactive',
            updated_at = NOW()
        WHERE id = $1;
      `,
      [ownerId]
    );

    await page.goto(shareLink.url);
    await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();

    await db.queryMany(
      `
        UPDATE users
        SET status = 'active',
            email_verified_at = NULL,
            updated_at = NOW()
        WHERE id = $1;
      `,
      [ownerId]
    );

    await page.goto(shareLink.url);
    await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();
  });
});
