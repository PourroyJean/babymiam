import { expect, test } from "../fixtures/test-fixtures";

const DEFAULT_E2E_AUTH_EMAIL = (process.env.E2E_AUTH_EMAIL || "ljcls@gmail.com").toLowerCase();

function getIsoDateDaysAgo(daysAgo: number) {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(utcMidnight - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.describe("pediatric report", () => {
  test("includes the detailed allergen consultation table in the PDF", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    const birthDate = getIsoDateDaysAgo(220);
    const recentDay1 = getIsoDateDaysAgo(2);
    const recentDay2 = getIsoDateDaysAgo(4);
    const recentDay3 = getIsoDateDaysAgo(6);

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
      [ownerId, "Nina", birthDate]
    );

    await db.setFoodTastingsByName("Carotte", [
      { slot: 1, liked: true, tastedOn: recentDay3, reactionType: 0 },
      { slot: 2, liked: false, tastedOn: recentDay2, reactionType: 4 }
    ]);
    await db.setFoodTastingsByName("Arachides", [{ slot: 1, liked: true, tastedOn: recentDay1, reactionType: 1 }]);

    await appPage.reload();
    await expect(appPage.getByRole("button", { name: /Télécharger le rapport pédiatre en PDF/i })).toBeVisible();

    const response = await appPage.request.get("/api/pediatric-report?tzOffsetMinutes=120");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect(response.headers()["content-disposition"]).toContain("attachment; filename=\"grrrignote-rapport-pediatre-");

    const pdfBinary = await response.body();
    const pdfText = pdfBinary.toString("latin1");

    expect(pdfText).toContain("Grrrignote - Rapport pediatre");
    expect(pdfText).toContain("VUE GLOBALE DIVERSIFICATION");
    expect(pdfText).toContain("DYNAMIQUE RÉCENTE");
    expect(pdfText).toContain("TABLEAU ALLERG");
    expect(pdfText).toContain("Allergène");
    expect(pdfText).toContain("Dernière");
    expect(pdfText).toContain("Réaction");
    expect(pdfText).toMatch(/Arachides\s+\|\s+1\/3\s+\|\s+\d{2}\/\d{2}\/\d{4}\s+\|\s+Cutanée/i);
    expect(pdfText).toContain("Avec symptôme observé");
    expect(pdfText).toContain("SIGNAUX DE VIGILANCE À DISCUTER");
    expect(pdfText).toContain("Respiratoire");
  });

  test("flags respiratory allergen reactions and keeps non-introduced allergen rows", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    const birthDate = getIsoDateDaysAgo(330);
    const recentDay = getIsoDateDaysAgo(3);

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
      [ownerId, "Nina", birthDate]
    );

    await db.setFoodTastingsByName("Arachides", [{ slot: 1, liked: false, tastedOn: recentDay, reactionType: 4 }]);

    await appPage.reload();
    await expect(appPage.getByRole("button", { name: /Télécharger le rapport pédiatre en PDF/i })).toBeVisible();

    const response = await appPage.request.get("/api/pediatric-report?tzOffsetMinutes=120");
    expect(response.status()).toBe(200);

    const pdfText = (await response.body()).toString("latin1");
    expect(pdfText).toMatch(/Arachides\s+\|\s+1\/3\s+\|\s+\d{2}\/\d{2}\/\d{4}\s+\|\s+Respiratoire/i);
    expect(pdfText).toContain("Vigilance: ALERTE respiratoire - avis médical rapide");
    expect(pdfText).toMatch(/Soja\s+\|\s+0\/3\s+\|\s+-\s+\|\s+Aucun symptôme/i);
  });

  test("returns 402 for authenticated users without pediatric-report premium access", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    await db.queryMany("UPDATE users SET email = $2 WHERE id = $1;", [ownerId, "blocked-parent@example.com"]);

    try {
      const response = await appPage.request.get("/api/pediatric-report?tzOffsetMinutes=120");
      expect(response.status()).toBe(402);
      expect(await response.text()).toContain("Rapport pédiatre réservé à l'offre Premium.");
    } finally {
      await db.queryMany("UPDATE users SET email = $2 WHERE id = $1;", [ownerId, DEFAULT_E2E_AUTH_EMAIL]);
    }
  });

  test("redirects unauthenticated access to login for pediatric report API", async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.request.get("/api/pediatric-report?tzOffsetMinutes=120", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/login");
  });
});
