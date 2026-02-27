#!/usr/bin/env node

const { Pool } = require("pg");
const { createSharedTestLoginToken } = require("../../lib/shared-test-login-token");
const { resolveDatabaseUrl } = require("../db/_db-url");
const {
  buildSharedTestMagicLoginUrl,
  ensureSharedTestLinkIssuedAtNow,
  getSharedTestTokenExpiresAtIsoForUser,
  getSharedTestTokenIssuedAtEpochSeconds,
  isSharedTestTokenExpiredForUser,
  loadSharedTestAccessUser,
  resolveAppBaseUrl,
  resolvePrimaryAuthSecret,
  resolveSharedTestAccessEmail
} = require("./_shared-test-link");

async function run() {
  const email = resolveSharedTestAccessEmail();
  const baseUrl = resolveAppBaseUrl();
  const secret = resolvePrimaryAuthSecret();
  const { databaseUrl } = resolveDatabaseUrl({ scriptName: "users:test-link:generate" });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const user = await loadSharedTestAccessUser(pool, email);
    let tokenUserShape = user;
    let initializedIssuedAt = false;
    let regenerated = false;
    let tokenIssuedAtEpochSeconds = getSharedTestTokenIssuedAtEpochSeconds(user);

    if (!tokenIssuedAtEpochSeconds) {
      const initialized = await ensureSharedTestLinkIssuedAtNow(pool, user.id);
      if (!initialized.sharedTestLinkIssuedAt) {
        throw new Error("[users:test-link:generate] Failed to initialize shared test link validity window.");
      }

      tokenUserShape = {
        ...user,
        sharedTestLinkIssuedAt: initialized.sharedTestLinkIssuedAt
      };
      initializedIssuedAt = true;
      tokenIssuedAtEpochSeconds = getSharedTestTokenIssuedAtEpochSeconds(tokenUserShape);
    } else if (isSharedTestTokenExpiredForUser(user)) {
      const refreshed = await ensureSharedTestLinkIssuedAtNow(pool, user.id, { forceNow: true });
      if (!refreshed.sharedTestLinkIssuedAt) {
        throw new Error("[users:test-link:generate] Failed to refresh shared test link validity window.");
      }

      tokenUserShape = {
        ...user,
        sharedTestLinkIssuedAt: refreshed.sharedTestLinkIssuedAt
      };
      regenerated = true;
      tokenIssuedAtEpochSeconds = getSharedTestTokenIssuedAtEpochSeconds(tokenUserShape);
    }

    if (!tokenIssuedAtEpochSeconds) {
      throw new Error("[users:test-link:generate] Failed to resolve shared test token issued-at timestamp.");
    }

    const token = createSharedTestLoginToken({
      userId: user.id,
      issuedAtEpochSeconds: tokenIssuedAtEpochSeconds,
      secret
    });
    const link = buildSharedTestMagicLoginUrl(baseUrl, token);
    const expiresAtIso = getSharedTestTokenExpiresAtIsoForUser(tokenUserShape);

    if (regenerated) {
      console.log("[users:test-link:generate] Shared test magic link regenerated (previous token expired).");
      console.log("[users:test-link:generate] Old links invalidated.");
    } else if (initializedIssuedAt) {
      console.log("[users:test-link:generate] Shared test magic link initialized.");
    } else {
      console.log("[users:test-link:generate] Shared test magic link still valid; existing token reused.");
    }
    if (expiresAtIso) {
      console.log(`[users:test-link:generate] Expires at: ${expiresAtIso}`);
    }
    console.log("[users:test-link:generate] Keep this link private.");
    console.log(`[users:test-link:generate] Account: ${user.email}`);
    console.log(link);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(
    `[users:test-link:generate] Failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
