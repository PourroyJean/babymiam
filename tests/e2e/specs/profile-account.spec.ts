import { expect, test } from "../fixtures/test-fixtures";

const AUTH_EMAIL = (process.env.E2E_AUTH_EMAIL || "parent@example.com").toLowerCase();

test.describe("profile account", () => {
  test("shows account overview and blocks password update when confirmation mismatches", async ({ appPage }) => {
    await appPage.getByRole("button", { name: "Profil" }).click();

    const dialog = appPage.getByRole("dialog", { name: "Profil" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("tab", { name: "Compte" }).click();

    await expect(dialog.getByText(AUTH_EMAIL)).toBeVisible();

    await dialog.getByLabel("Mot de passe actuel").fill("does-not-matter");
    await dialog.getByLabel("Nouveau mot de passe").fill("new-password");
    await dialog.getByLabel("Confirmer le mot de passe").fill("new-password-2");
    await dialog.getByRole("button", { name: "Mettre à jour" }).click();

    await expect(dialog.getByText("Les deux mots de passe ne correspondent pas.")).toBeVisible();
  });
});

