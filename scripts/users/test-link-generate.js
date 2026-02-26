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
  resolveSharedTestAccessEmail,
  rotateSessionVersionForUser
} = require("./_shared-test-link");

async function run() {
  const email = resolveSharedTestAccessEmail();
  const baseUrl = resolveAppBaseUrl();
  const secret = resolvePrimaryAuthSecret();
  const { databaseUrl } = resolveDatabaseUrl({ scriptName: "users:test-link:generate" });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const user = await loadSharedTestAccessUser(pool, email);
    let tokenSessionVersion = user.sessionVersion;
    let tokenUserShape = user;
    let initializedIssuedAt = false;
    let regenerated = false;

    if (!getSharedTestTokenIssuedAtEpochSeconds(user)) {
      const initialized = await ensureSharedTestLinkIssuedAtNow(pool, user.id);
      if (!initialized.sessionVersion) {
        throw new Error("[users:test-link:generate] Failed to initialize shared test link validity window.");
      }

      tokenSessionVersion = initialized.sessionVersion;
      tokenUserShape = {
        ...user,
        sessionVersion: initialized.sessionVersion,
        sharedTestLinkIssuedAt: initialized.sharedTestLinkIssuedAt
      };
      initializedIssuedAt = true;
    } else if (isSharedTestTokenExpiredForUser(user)) {
      const rotated = await rotateSessionVersionForUser(pool, user.id, { issueNow: true });
      if (!rotated.sessionVersion) {
        throw new Error("[users:test-link:generate] Failed to rotate session version.");
      }

      tokenSessionVersion = rotated.sessionVersion;
      tokenUserShape = {
        ...user,
        sessionVersion: rotated.sessionVersion,
        sharedTestLinkIssuedAt: rotated.sharedTestLinkIssuedAt
      };
      regenerated = true;
    }

    const token = createSharedTestLoginToken({
      userId: user.id,
      sessionVersion: tokenSessionVersion,
      secret
    });
    const link = buildSharedTestMagicLoginUrl(baseUrl, token);
    const expiresAtIso = getSharedTestTokenExpiresAtIsoForUser(tokenUserShape);

    if (regenerated) {
      console.log("[users:test-link:generate] Shared test magic link regenerated (previous token expired).");
      console.log("[users:test-link:generate] Old links invalidated and active sessions logged out.");
    } else if (initializedIssuedAt) {
      console.log("[users:test-link:generate] Shared test magic link initialized.");
      console.log("[users:test-link:generate] No session invalidation performed.");
    } else {
      console.log("[users:test-link:generate] Shared test magic link still valid; existing token reused.");
      console.log("[users:test-link:generate] No session invalidation performed.");
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
