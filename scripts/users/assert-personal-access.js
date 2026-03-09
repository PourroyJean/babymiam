#!/usr/bin/env node

const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("../db/_db-url");
const { hasPremiumAccess } = require("../../lib/premium-entitlement-core");
const {
  DEFAULT_PERSONAL_ACCESS_EMAIL
} = require("./ensure-personal-access");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolvePersonalAccessEmail(env = process.env) {
  const canonical = String(env.PERSONAL_ACCESS_EMAIL || "").trim().toLowerCase();
  const resolved = canonical || DEFAULT_PERSONAL_ACCESS_EMAIL;

  if (!EMAIL_PATTERN.test(resolved)) {
    throw new Error(`Invalid PERSONAL_ACCESS_EMAIL format: ${JSON.stringify(resolved)}.`);
  }

  return resolved;
}

async function run() {
  const personalAccessEmail = resolvePersonalAccessEmail(process.env);
  const { databaseUrl } = resolveDatabaseUrl({
    scriptName: "db:assert-personal-access",
    env: process.env
  });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          email::text AS email,
          status,
          email_verified_at::text AS email_verified_at
        FROM users
        WHERE email = $1
        LIMIT 1;
      `,
      [personalAccessEmail]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`User not found: ${personalAccessEmail}`);
    }

    if (row.status !== "active") {
      throw new Error(`Expected status=active for ${personalAccessEmail}, got ${JSON.stringify(row.status)}.`);
    }

    if (!row.email_verified_at) {
      throw new Error(`Expected email_verified_at to be non-null for ${personalAccessEmail}.`);
    }

    const premium = hasPremiumAccess({ id: Number(row.id), email: row.email }, process.env);
    if (!premium) {
      throw new Error(
        `Expected premium access for ${personalAccessEmail}, but entitlement check returned false.`
      );
    }

    console.log("[db:assert-personal-access] OK:", {
      id: Number(row.id),
      email: row.email,
      status: row.status,
      emailVerifiedAt: row.email_verified_at,
      premium
    });
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(
    `[db:assert-personal-access] Failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
