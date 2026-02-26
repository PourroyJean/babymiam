const crypto = require("crypto");

const TOKEN_PATTERN = /^(\d+)\.(\d+)\.([a-f0-9]{64})$/;
const SIGNATURE_NAMESPACE = "shared-test-login:v1";
const SHARED_TEST_LOGIN_TTL_SECONDS = 31 * 24 * 60 * 60;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function safeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function buildSignaturePayload(userId, sessionVersion) {
  return `${SIGNATURE_NAMESPACE}:${userId}:${sessionVersion}`;
}

function normalizeEpochSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  const normalized = Math.trunc(parsed);
  if (!isPositiveInteger(normalized)) return null;
  return normalized;
}

function getNowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getSharedTestLoginTokenExpiresAtEpochSeconds(issuedAtEpochSeconds) {
  const issuedAt = normalizeEpochSeconds(issuedAtEpochSeconds);
  if (!issuedAt) return null;
  return issuedAt + SHARED_TEST_LOGIN_TTL_SECONDS;
}

function isSharedTestLoginTokenExpired({ issuedAtEpochSeconds, nowEpochSeconds = getNowEpochSeconds() }) {
  const issuedAt = normalizeEpochSeconds(issuedAtEpochSeconds);
  const now = normalizeEpochSeconds(nowEpochSeconds);
  if (!issuedAt || !now) return true;

  const expiresAt = getSharedTestLoginTokenExpiresAtEpochSeconds(issuedAt);
  if (!expiresAt) return true;

  return now >= expiresAt;
}

function computeSharedTestLoginSignature({ userId, sessionVersion, secret }) {
  if (!isPositiveInteger(userId)) {
    throw new Error("Invalid shared test login token user id.");
  }

  if (!isPositiveInteger(sessionVersion)) {
    throw new Error("Invalid shared test login token session version.");
  }

  const normalizedSecret = String(secret || "");
  if (!normalizedSecret) {
    throw new Error("Missing secret for shared test login token.");
  }

  return crypto
    .createHmac("sha256", normalizedSecret)
    .update(buildSignaturePayload(userId, sessionVersion))
    .digest("hex");
}

function parseSharedTestLoginToken(token) {
  const rawToken = String(token || "").trim();
  const match = rawToken.match(TOKEN_PATTERN);
  if (!match) return null;

  const userId = Number(match[1]);
  const sessionVersion = Number(match[2]);
  const signature = String(match[3] || "");

  if (!isPositiveInteger(userId)) return null;
  if (!isPositiveInteger(sessionVersion)) return null;
  if (!signature) return null;

  return { userId, sessionVersion, signature };
}

function createSharedTestLoginToken({ userId, sessionVersion, secret }) {
  const signature = computeSharedTestLoginSignature({ userId, sessionVersion, secret });
  return `${userId}.${sessionVersion}.${signature}`;
}

function verifySharedTestLoginToken({ token, secrets }) {
  const parsed = parseSharedTestLoginToken(token);
  if (!parsed) return null;

  const normalizedSecrets = Array.isArray(secrets)
    ? secrets.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  if (normalizedSecrets.length === 0) return null;

  const hasValidSignature = normalizedSecrets.some((secret) => {
    const expected = computeSharedTestLoginSignature({
      userId: parsed.userId,
      sessionVersion: parsed.sessionVersion,
      secret
    });
    return safeEqualHex(expected, parsed.signature);
  });

  if (!hasValidSignature) return null;

  return {
    userId: parsed.userId,
    sessionVersion: parsed.sessionVersion
  };
}

module.exports = {
  createSharedTestLoginToken,
  getSharedTestLoginTokenExpiresAtEpochSeconds,
  isSharedTestLoginTokenExpired,
  parseSharedTestLoginToken,
  SHARED_TEST_LOGIN_TTL_SECONDS,
  verifySharedTestLoginToken
};
