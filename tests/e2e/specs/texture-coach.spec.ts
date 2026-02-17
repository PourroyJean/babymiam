import { expect, test } from "../fixtures/test-fixtures";

test.describe("texture coach premium", () => {
  test("surfaces a texture priority status when texture progression is far behind age target", async ({
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
      [ownerId, "Lina", "2020-01-01"]
    );

    await db.setFoodTastingsByName("Carotte", [
      { slot: 1, liked: true, tastedOn: "2025-01-10", textureLevel: 1, reactionType: 0 },
      { slot: 2, liked: true, tastedOn: "2025-01-11", textureLevel: 1, reactionType: 0 }
    ]);
    await db.setFoodTastingsByName("Banane", [
      { slot: 1, liked: true, tastedOn: "2025-01-12", textureLevel: 1, reactionType: 0 }
    ]);

    await appPage.reload();

    const coachCard = appPage.getByLabel("Coach textures Premium");
    await expect(coachCard).toBeVisible();
    await expect(coachCard.getByText("Priorite texture")).toBeVisible();
    await expect(coachCard.getByText(/Niveau observe:\s*Niveau 1/i)).toBeVisible();
    await expect(coachCard.getByText(/niveau 4/i)).toBeVisible();
  });
});
