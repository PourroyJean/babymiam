import { expect, test } from "../fixtures/test-fixtures";

const AUTH_EMAIL = (process.env.E2E_AUTH_EMAIL || "e2e-parent@example.test").toLowerCase();

test.describe("profile account", () => {
  test("shows account overview and blocks password update when confirmation mismatches", async ({ appPage }) => {
    await appPage.getByRole("button", { name: "Mon compte" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Mon compte" });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByText(AUTH_EMAIL)).toBeVisible();

    await dialog.getByLabel("Mot de passe actuel").fill("does-not-matter");
    await dialog.getByLabel("Nouveau mot de passe").fill("new-password");
    await dialog.getByLabel("Confirmer le mot de passe").fill("new-password-2");
    await dialog.getByRole("button", { name: "Mettre à jour" }).click();

    await expect(dialog.getByText("Les deux mots de passe ne correspondent pas.")).toBeVisible();
  });

  test("shows an error when verification email delivery is unavailable", async ({ appPage, db }) => {
    const ownerId = await db.getDefaultOwnerId();
    await db.queryMany(
      `
        UPDATE users
        SET email_verified_at = NULL,
            updated_at = NOW()
        WHERE id = $1;
      `,
      [ownerId]
    );

    await appPage.reload();
    await appPage.getByRole("button", { name: "Mon compte" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Mon compte" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Envoyer un lien de vérification" }).click();
    await expect(dialog.getByText("Le service email est temporairement indisponible. Réessaie plus tard.")).toBeVisible();
  });
});
