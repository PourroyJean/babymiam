import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/test-fixtures";

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL || "parent@example.com";
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || "LOULOU38";
const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3005";
const FORGOT_PASSWORD_CONFIRMATION =
  "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.";

async function submitForgotPassword(page: Page, email: string) {
  await page.goto("/forgot-password");
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page).toHaveURL(/\/forgot-password\?sent=1$/);
  await expect(page.getByText(FORGOT_PASSWORD_CONFIRMATION)).toBeVisible();
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
    await page.locator('input[name="password"]').fill(AUTH_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Les premiers aliments/i })).toBeVisible();
  });

  test("logout clears session and blocks protected pages", async ({ page, loginAsDefaultUser }) => {
    await loginAsDefaultUser();

    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
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
