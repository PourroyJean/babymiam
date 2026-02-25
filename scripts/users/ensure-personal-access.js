#!/usr/bin/env node

const argon2 = require("argon2");
const { Pool } = require("pg");
const { isStrictRuntime, resolveDatabaseUrl } = require("../db/_db-url");

const DEFAULT_PERSONAL_ACCESS_EMAIL = "ljcls@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getEnv(name, env = process.env) {
  return String(env[name] || "").trim();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(value);
}

function resolvePersonalAccessCredentials(env = process.env) {
  const strictRuntime = isStrictRuntime(env);

  const canonicalEmail = getEnv("PERSONAL_ACCESS_EMAIL", env);
  const canonicalPassword = getEnv("PERSONAL_ACCESS_PASSWORD", env);
  const email = canonicalEmail || (strictRuntime ? "" : DEFAULT_PERSONAL_ACCESS_EMAIL);
  const password = canonicalPassword;

  if (!email || !password) {
    throw new Error(
      "[db:ensure-personal-access] Missing credentials. Configure PERSONAL_ACCESS_EMAIL and PERSONAL_ACCESS_PASSWORD."
    );
  }

  const normalizedEmail = email.toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new Error(
      `[db:ensure-personal-access] Invalid email format: ${JSON.stringify(email)}. Expected a valid email address.`
    );
  }

  if (password.length < 8) {
    throw new Error("[db:ensure-personal-access] Password must contain at least 8 characters.");
  }

  return {
    email: normalizedEmail,
    password
  };
}

async function defaultHashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

async function upsertPersonalAccessUser({ pool, email, password, hashPassword = defaultHashPassword }) {
  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `
      INSERT INTO users (email, password_hash, status, email_verified_at)
      VALUES ($1, $2, 'active', NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        status = 'active',
        email_verified_at = COALESCE(users.email_verified_at, NOW()),
        updated_at = NOW()
      RETURNING id, email::text AS email, status, email_verified_at::text AS email_verified_at;
    `,
    [email, passwordHash]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("[db:ensure-personal-access] Failed to upsert personal access user.");
  }

  return {
    id: Number(row.id),
    email: row.email,
    status: row.status,
    emailVerifiedAt: row.email_verified_at
  };
}

async function ensurePersonalAccess({
  env = process.env,
  databaseUrl,
  createPool = (options) => new Pool(options),
  hashPassword = defaultHashPassword
} = {}) {
  const credentials = resolvePersonalAccessCredentials(env);
  const resolvedDatabaseUrl = databaseUrl || resolveDatabaseUrl({ scriptName: "db:ensure-personal-access", env }).databaseUrl;
  const pool = createPool({ connectionString: resolvedDatabaseUrl });

  try {
    return await upsertPersonalAccessUser({
      pool,
      email: credentials.email,
      password: credentials.password,
      hashPassword
    });
  } finally {
    await pool.end();
  }
}

async function run() {
  const user = await ensurePersonalAccess();
  console.log("[db:ensure-personal-access] User upserted:", user);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(
      `[db:ensure-personal-access] Failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_PERSONAL_ACCESS_EMAIL,
  ensurePersonalAccess,
  resolvePersonalAccessCredentials
};
