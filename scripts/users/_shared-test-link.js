const { isStrictRuntime } = require("../db/_db-url");
const {
  getSharedTestLoginTokenExpiresAtEpochSeconds,
  isSharedTestLoginTokenExpired
} = require("../../lib/shared-test-login-token");

const DEV_FALLBACK_SECRET = "dev-only-secret-change-me";
const DEFAULT_APP_BASE_URL = "http://127.0.0.1:3000";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getEnv(name, env = process.env) {
  return String(env[name] || "").trim();
}

function getBooleanEnv(name, env = process.env) {
  return getEnv(name, env) === "1";
}

function resolveSharedTestAccessEmail(env = process.env) {
  const email = getEnv("PERSONAL_ACCESS_EMAIL", env).toLowerCase();
  if (!email) {
    throw new Error("[users:test-link] Missing PERSONAL_ACCESS_EMAIL.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error(`[users:test-link] Invalid PERSONAL_ACCESS_EMAIL: ${JSON.stringify(email)}.`);
  }

  return email;
}

function resolveAppBaseUrl(env = process.env) {
  const configuredBaseUrl = getEnv("APP_BASE_URL", env);
  const strictRuntime = isStrictRuntime(env);
  const rawBaseUrl = configuredBaseUrl || (strictRuntime ? "" : DEFAULT_APP_BASE_URL);
  if (!rawBaseUrl) {
    throw new Error("[users:test-link] Missing APP_BASE_URL.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error(`[users:test-link] Invalid APP_BASE_URL: ${JSON.stringify(rawBaseUrl)}.`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("[users:test-link] APP_BASE_URL must use http or https.");
  }

  parsedUrl.pathname = "/";
  parsedUrl.search = "";
  parsedUrl.hash = "";
  return parsedUrl.toString().replace(/\/$/, "");
}

function resolveAuthSecrets(env = process.env) {
  const fromList = getEnv("AUTH_SECRETS", env)
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
  if (fromList.length > 0) return fromList;

  const single = getEnv("AUTH_SECRET", env);
  if (single) return [single];

  const allowInsecureDevAuth = getBooleanEnv("ALLOW_INSECURE_DEV_AUTH", env);
  if (isStrictRuntime(env) || !allowInsecureDevAuth) {
    throw new Error(
      "[users:test-link] AUTH_SECRET or AUTH_SECRETS must be set. For local-only fallback, set ALLOW_INSECURE_DEV_AUTH=1."
    );
  }

  return [DEV_FALLBACK_SECRET];
}

function resolvePrimaryAuthSecret(env = process.env) {
  return resolveAuthSecrets(env)[0];
}

async function loadSharedTestAccessUser(pool, email) {
  const result = await pool.query(
    `
      SELECT
        id,
        email::text AS email,
        session_version,
        status,
        shared_test_link_issued_at::text AS shared_test_link_issued_at
      FROM users
      WHERE email = $1
      LIMIT 1;
    `,
    [email]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`[users:test-link] User not found for PERSONAL_ACCESS_EMAIL=${JSON.stringify(email)}.`);
  }

  if (row.status !== "active") {
    throw new Error("[users:test-link] PERSONAL_ACCESS_EMAIL user must be active.");
  }

  return {
    id: Number(row.id),
    email: row.email,
    sessionVersion: Number(row.session_version),
    status: row.status,
    sharedTestLinkIssuedAt: row.shared_test_link_issued_at
  };
}

async function rotateSessionVersionForUser(pool, userId, options = {}) {
  const clearIssuedAt = options?.clearIssuedAt === true;
  const issueNow = options?.issueNow === true;
  if (clearIssuedAt && issueNow) {
    throw new Error("[users:test-link] rotateSessionVersionForUser options conflict: clearIssuedAt + issueNow.");
  }

  const issuedAtAssignment = issueNow
    ? "shared_test_link_issued_at = NOW(),"
    : clearIssuedAt
      ? "shared_test_link_issued_at = NULL,"
      : "";

  const result = await pool.query(
    `
      UPDATE users
      SET
        session_version = session_version + 1,
        ${issuedAtAssignment}
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        session_version,
        shared_test_link_issued_at::text AS shared_test_link_issued_at;
    `,
    [userId]
  );

  const row = result.rows[0];
  return {
    sessionVersion: Number(row?.session_version || 0),
    sharedTestLinkIssuedAt: row?.shared_test_link_issued_at
  };
}

async function ensureSharedTestLinkIssuedAtNow(pool, userId) {
  const result = await pool.query(
    `
      UPDATE users
      SET
        shared_test_link_issued_at = COALESCE(shared_test_link_issued_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        session_version,
        shared_test_link_issued_at::text AS shared_test_link_issued_at;
    `,
    [userId]
  );

  const row = result.rows[0];
  return {
    sessionVersion: Number(row?.session_version || 0),
    sharedTestLinkIssuedAt: row?.shared_test_link_issued_at
  };
}

function toEpochSeconds(timestamp) {
  const parsed = Date.parse(String(timestamp || ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed / 1000);
}

function getSharedTestTokenIssuedAtEpochSeconds(user) {
  return toEpochSeconds(user?.sharedTestLinkIssuedAt || null);
}

function isSharedTestTokenExpiredForUser(user) {
  const issuedAtEpochSeconds = getSharedTestTokenIssuedAtEpochSeconds(user);
  if (!issuedAtEpochSeconds) return true;

  return isSharedTestLoginTokenExpired({ issuedAtEpochSeconds });
}

function getSharedTestTokenExpiresAtIsoForUser(user) {
  const issuedAtEpochSeconds = getSharedTestTokenIssuedAtEpochSeconds(user);
  if (!issuedAtEpochSeconds) return null;

  const expiresAtEpochSeconds = getSharedTestLoginTokenExpiresAtEpochSeconds(issuedAtEpochSeconds);
  if (!expiresAtEpochSeconds) return null;

  return new Date(expiresAtEpochSeconds * 1000).toISOString();
}

function buildSharedTestMagicLoginUrl(baseUrl, token) {
  const url = new URL("/magic-login", baseUrl);
  url.searchParams.set("t", token);
  return url.toString();
}

module.exports = {
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
};
