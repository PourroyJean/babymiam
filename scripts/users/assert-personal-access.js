#!/usr/bin/env node

const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("../db/_db-url");
const {
  DEFAULT_PERSONAL_ACCESS_EMAIL
} = require("./ensure-personal-access");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(rawValue) {
  return new Set(
    String(rawValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function normalizeCsvEmails(value) {
  return new Set(
    [...parseCsv(value)]
      .map((item) => item.toLowerCase())
      .filter(Boolean)
  );
}

function shouldEnforcePremiumGating(env = process.env) {
  const mode = String(env.PREMIUM_GATE_MODE || "auto").trim().toLowerCase();
  if (mode === "off") return false;
  if (mode === "on") return true;
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function resolvePersonalAccessEmail(env = process.env) {
  const canonical = String(env.PERSONAL_ACCESS_EMAIL || "").trim().toLowerCase();
  const resolved = canonical || DEFAULT_PERSONAL_ACCESS_EMAIL;

  if (!EMAIL_PATTERN.test(resolved)) {
    throw new Error(`Invalid PERSONAL_ACCESS_EMAIL format: ${JSON.stringify(resolved)}.`);
  }

  return resolved;
}

function resolvePersonalPremiumEmails(env = process.env) {
  const emails = new Set([DEFAULT_PERSONAL_ACCESS_EMAIL]);
  const canonical = String(env.PERSONAL_ACCESS_EMAIL || "").trim().toLowerCase();
  if (canonical) {
    emails.add(canonical);
  }

  return emails;
}

function getAllowedEmailsForFeature(env = process.env) {
  const allowed = new Set();
  const featureEmails = normalizeCsvEmails(env.PEDIATRIC_REPORT_PREMIUM_USER_EMAILS);
  const globalEmails = normalizeCsvEmails(env.PREMIUM_FEATURE_USER_EMAILS);

  if (featureEmails.size > 0) {
    for (const email of featureEmails) allowed.add(email);
  } else if (globalEmails.size > 0) {
    for (const email of globalEmails) allowed.add(email);
  } else if (String(env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    allowed.add(DEFAULT_PERSONAL_ACCESS_EMAIL);
  }

  for (const email of resolvePersonalPremiumEmails(env)) {
    allowed.add(email);
  }

  return allowed;
}

function getAllowedIdsForFeature(env = process.env) {
  const featureIds = parseCsv(env.PEDIATRIC_REPORT_PREMIUM_USER_IDS);
  if (featureIds.size > 0) return featureIds;
  return parseCsv(env.PREMIUM_FEATURE_USER_IDS);
}

function hasPremiumFeatureAccess(user, env = process.env) {
  if (!shouldEnforcePremiumGating(env)) return true;

  const allowedIds = getAllowedIdsForFeature(env);
  const allowedEmails = getAllowedEmailsForFeature(env);

  const normalizedUserId = String(user.id);
  const normalizedEmail = String(user.email || "").trim().toLowerCase();

  if (allowedIds.has(normalizedUserId)) return true;
  if (normalizedEmail && allowedEmails.has(normalizedEmail)) return true;
  return false;
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

    const premium = hasPremiumFeatureAccess({ id: Number(row.id), email: row.email }, process.env);
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
