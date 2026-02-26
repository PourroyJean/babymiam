#!/usr/bin/env node

const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("../db/_db-url");
const {
  loadSharedTestAccessUser,
  resolveSharedTestAccessEmail,
  rotateSessionVersionForUser
} = require("./_shared-test-link");

async function run() {
  const email = resolveSharedTestAccessEmail();
  const { databaseUrl } = resolveDatabaseUrl({ scriptName: "users:test-link:revoke" });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const user = await loadSharedTestAccessUser(pool, email);
    const rotated = await rotateSessionVersionForUser(pool, user.id, { clearIssuedAt: true });
    if (!rotated.sessionVersion) {
      throw new Error("[users:test-link:revoke] Failed to rotate session version.");
    }

    console.log("[users:test-link:revoke] Shared test magic link revoked.");
    console.log("[users:test-link:revoke] Active sessions logged out.");
    console.log(`[users:test-link:revoke] Account: ${user.email}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(`[users:test-link:revoke] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
