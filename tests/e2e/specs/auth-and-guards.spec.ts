import type { Page } from "@playwright/test";
import { createSharedTestLoginToken } from "../../../lib/shared-test-login-token";
import { expect, test } from "../fixtures/test-fixtures";

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL || "e2e-parent@example.test";
const E2E_PASSWORD = process.env.E2E_AUTH_PASSWORD || "e2e-test-password";
const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3005";
const FORGOT_PASSWORD_CONFIRMATION =
  "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.";

function getPrimaryE2EAuthSecret() {
  const secrets = String(process.env.AUTH_SECRETS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (secrets.length > 0) return secrets[0];
  return process.env.E2E_AUTH_SECRET || "e2e-secret-change-me";
}

async function submitForgotPassword(page: Page, email: string) {
  await page.goto("/forgot-password");
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page).toHaveURL(/\/forgot-password\?sent=1$/);
  await expect(page.getByText(FORGOT_PASSWORD_CONFIRMATION)).toBeVisible();
}

async function openMagicLogin(page: Page, token: string) {
  await page.goto(`/magic-login?t=${encodeURIComponent(token)}`, {
    waitUntil: "domcontentloaded"
  });
}

async function getSharedTestTokenSeedForDefaultUser(db: {
  queryOne: (text: string, values?: unknown[]) => Promise<unknown>;
}) {
  const user = (await db.queryOne(
    `
      SELECT
        id,
        FLOOR(EXTRACT(EPOCH FROM shared_test_link_issued_at))::bigint AS issued_at_epoch_seconds
      FROM users
      WHERE email = $1
      LIMIT 1;
    `,
    [AUTH_EMAIL.toLowerCase()]
  )) as { id?: number; issued_at_epoch_seconds?: number } | null;

  const userId = Number(user?.id || 0);
  const issuedAtEpochSeconds = Number(user?.issued_at_epoch_seconds || 0);
  expect(userId).toBeGreaterThan(0);
  expect(issuedAtEpochSeconds).toBeGreaterThan(0);

  return {
    userId,
    issuedAtEpochSeconds
  };
}

async function getSharedTestTokenForDefaultUser(db: {
  queryOne: (text: string, values?: unknown[]) => Promise<unknown>;
}) {
  const tokenSeed = await getSharedTestTokenSeedForDefaultUser(db);

  return createSharedTestLoginToken({
    userId: tokenSeed.userId,
    issuedAtEpochSeconds: tokenSeed.issuedAtEpochSeconds,
    secret: getPrimaryE2EAuthSecret()
  });
}

test.describe("auth and guards", () => {
  test("applies baseline security headers on login page", async ({ request }) => {
    const response = await request.get("/login");
    expect(response.ok()).toBeTruthy();

    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });

  test("redirects guest to /login when opening a protected page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows error when credentials are invalid", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[name="email"]').fill("wrong@example.com");
    await page.locator('input[name="password"]').fill("wrong");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/login\?error=1$/);
    await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
  });

  test("rejects invalid shared test magic link token", async ({ page }) => {
    await openMagicLogin(page, "invalid");
    await expect(page).toHaveURL(/\/login\?error=1$/);
  });

  test("accepts valid shared test magic link token", async ({ page, db }) => {
    const token = await getSharedTestTokenForDefaultUser(db);
    await openMagicLogin(page, token);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Les premiers aliments/i })).toBeVisible();
  });

  test("rejects expired shared test magic link token", async ({ page, db }) => {
    const tokenSeed = await getSharedTestTokenSeedForDefaultUser(db);
    const expiredIssuedAtEpochSeconds = Math.floor(Date.now() / 1000) - 32 * 24 * 60 * 60;

    await db.queryOne(
      `
        UPDATE users
        SET
          shared_test_link_issued_at = TO_TIMESTAMP($2),
          updated_at = NOW()
        WHERE id = $1
        RETURNING shared_test_link_issued_at;
      `,
      [tokenSeed.userId, expiredIssuedAtEpochSeconds]
    );

    const token = createSharedTestLoginToken({
      userId: tokenSeed.userId,
      issuedAtEpochSeconds: expiredIssuedAtEpochSeconds,
      secret: getPrimaryE2EAuthSecret()
    });

    await openMagicLogin(page, token);
    await expect(page).toHaveURL(/\/login\?error=1$/);
  });

  test("keeps shared test magic link token valid after session rotation", async ({ page, db }) => {
    const token = await getSharedTestTokenForDefaultUser(db);

    await db.queryOne(
      `
        UPDATE users
        SET
          session_version = session_version + 1,
          updated_at = NOW()
        WHERE email = $1
        RETURNING session_version;
      `,
      [AUTH_EMAIL.toLowerCase()]
    );

    await openMagicLogin(page, token);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Les premiers aliments/i })).toBeVisible();
  });

  test("invalidates previous shared test magic link token when issued-at changes", async ({ page, db }) => {
    const token = await getSharedTestTokenForDefaultUser(db);
    const tokenSeed = await getSharedTestTokenSeedForDefaultUser(db);

    await db.queryOne(
      `
        UPDATE users
        SET
          shared_test_link_issued_at = TO_TIMESTAMP($2),
          updated_at = NOW()
        WHERE id = $1
        RETURNING shared_test_link_issued_at;
      `,
      [tokenSeed.userId, tokenSeed.issuedAtEpochSeconds + 60]
    );

    await openMagicLogin(page, token);
    await expect(page).toHaveURL(/\/login\?error=1$/);
  });

  test("forgot-password throttles known emails without changing UX", async ({ page, db }) => {
    const targetEmail = AUTH_EMAIL.toLowerCase();
    const ownerId = await db.getDefaultOwnerId();

    await submitForgotPassword(page, targetEmail);
    await submitForgotPassword(page, targetEmail);

    const secondToken = await db.queryOne<{ created_at: string }>(
      `
        SELECT created_at::text AS created_at
        FROM password_reset_tokens
        WHERE user_id = $1
        LIMIT 1;
      `,
      [ownerId]
    );
    expect(secondToken?.created_at).toBeTruthy();

    await submitForgotPassword(page, targetEmail);

    const thirdToken = await db.queryOne<{ created_at: string }>(
      `
        SELECT created_at::text AS created_at
        FROM password_reset_tokens
        WHERE user_id = $1
        LIMIT 1;
      `,
      [ownerId]
    );
    expect(thirdToken?.created_at || "").toBe(secondToken?.created_at || "");

    const attempts = await db.queryOne<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM auth_password_reset_attempts
        WHERE email_norm = $1;
      `,
      [targetEmail]
    );
    expect(Number(attempts?.count || 0)).toBe(3);
  });

  test("forgot-password throttles unknown emails with identical UX", async ({ page, db }) => {
    const targetEmail = "nobody@example.com";

    await submitForgotPassword(page, targetEmail);
    await submitForgotPassword(page, targetEmail);
    await submitForgotPassword(page, targetEmail);

    const attempts = await db.queryOne<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM auth_password_reset_attempts
        WHERE email_norm = $1;
      `,
      [targetEmail]
    );
    expect(Number(attempts?.count || 0)).toBe(3);

    const tokenCount = await db.queryOne<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM password_reset_tokens t
        INNER JOIN users u ON u.id = t.user_id
        WHERE u.email = $1;
      `,
      [targetEmail]
    );
    expect(Number(tokenCount?.count || 0)).toBe(0);
  });

  test("logs in with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[name="email"]').fill(AUTH_EMAIL);
    await page.locator('input[name="password"]').fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Les premiers aliments/i })).toBeVisible();
  });

  test("logout clears session and blocks protected pages", async ({ page, loginAsDefaultUser }) => {
    await loginAsDefaultUser();

    await page.getByRole("button", { name: "Mon compte" }).click();
    const dialog = page.getByRole("dialog", { name: "Mon compte" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Se déconnecter" }).click();
    await dialog.getByRole("button", { name: "Se déconnecter maintenant" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unverified user can logout from Mon compte", async ({ page, db, loginAsDefaultUser }) => {
    await loginAsDefaultUser();
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

    await page.reload();

    await page.getByRole("button", { name: "Mon compte" }).click();
    const dialog = page.getByRole("dialog", { name: "Mon compte" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Vérifie ton email pour modifier le mot de passe et gérer les sessions.")
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Déconnecter les autres appareils" })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Se déconnecter" }).click();
    await dialog.getByRole("button", { name: "Se déconnecter maintenant" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("invalid session cookie is rejected by server-side auth", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "bb_session",
        value: "invalid.token",
        url: BASE_URL
      }
    ]);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
