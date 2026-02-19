import { expect, test } from "../fixtures/test-fixtures";

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL || "parent@example.com";
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || "LOULOU38";
const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3005";

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
