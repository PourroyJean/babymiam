const crypto = require("crypto");

const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const TOKEN_PATTERN = /^([A-Za-z0-9_-]{16,128})\.(\d+)\.([a-f0-9]{64})$/;
const SIGNATURE_NAMESPACE = "public-share-link:v1";
const DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS = 180;
const MAX_PUBLIC_SHARE_LINK_TTL_DAYS = 3650;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
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

function getPublicShareLinkTtlDays(env = process.env) {
  const rawValue = String(env.PUBLIC_SHARE_LINK_TTL_DAYS || env.SHARE_SNAPSHOT_TTL_DAYS || "").trim();
  const parsed = Number(rawValue || DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS);
  if (!Number.isFinite(parsed)) return DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS;

  const normalized = Math.trunc(parsed);
  if (normalized < 1) return DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS;
  return Math.min(normalized, MAX_PUBLIC_SHARE_LINK_TTL_DAYS);
}

function getPublicShareLinkTtlSeconds(env = process.env) {
  return getPublicShareLinkTtlDays(env) * 24 * 60 * 60;
}

function getPublicShareLinkExpiresAtEpochSeconds(issuedAtEpochSeconds, env = process.env) {
  const issuedAt = normalizeEpochSeconds(issuedAtEpochSeconds);
  if (!issuedAt) return null;
  return issuedAt + getPublicShareLinkTtlSeconds(env);
}

function isPublicShareLinkExpired({
  issuedAtEpochSeconds,
  expiresAtEpochSeconds,
  nowEpochSeconds = getNowEpochSeconds(),
  env = process.env
}) {
  const now = normalizeEpochSeconds(nowEpochSeconds);
  if (!now) return true;

  const explicitExpiry = normalizeEpochSeconds(expiresAtEpochSeconds);
  if (explicitExpiry) {
    return now >= explicitExpiry;
  }

  const expiresAt = getPublicShareLinkExpiresAtEpochSeconds(issuedAtEpochSeconds, env);
  if (!expiresAt) return true;
  return now >= expiresAt;
}

function safeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function buildSignaturePayload(publicId, issuedAtEpochSeconds) {
  return `${SIGNATURE_NAMESPACE}:${publicId}:${issuedAtEpochSeconds}`;
}

function computePublicShareSignature({ publicId, issuedAtEpochSeconds, secret }) {
  if (!PUBLIC_ID_PATTERN.test(String(publicId || ""))) {
    throw new Error("Invalid public share link public id.");
  }

  if (!isPositiveInteger(issuedAtEpochSeconds)) {
    throw new Error("Invalid public share link issued-at epoch seconds.");
  }

  const normalizedSecret = String(secret || "");
  if (!normalizedSecret) {
    throw new Error("Missing secret for public share link token.");
  }

  return crypto
    .createHmac("sha256", normalizedSecret)
    .update(buildSignaturePayload(publicId, issuedAtEpochSeconds))
    .digest("hex");
}

function parsePublicShareToken(token) {
  const rawToken = String(token || "").trim();
  const match = rawToken.match(TOKEN_PATTERN);
  if (!match) return null;

  const publicId = String(match[1] || "");
  const issuedAtEpochSeconds = Number(match[2]);
  const signature = String(match[3] || "");

  if (!PUBLIC_ID_PATTERN.test(publicId)) return null;
  if (!isPositiveInteger(issuedAtEpochSeconds)) return null;
  if (!signature) return null;

  return { publicId, issuedAtEpochSeconds, signature };
}

function createPublicShareToken({ publicId, issuedAtEpochSeconds, secret }) {
  const signature = computePublicShareSignature({ publicId, issuedAtEpochSeconds, secret });
  return `${publicId}.${issuedAtEpochSeconds}.${signature}`;
}

function verifyPublicShareToken({ token, secrets }) {
  const parsed = parsePublicShareToken(token);
  if (!parsed) return null;

  const normalizedSecrets = Array.isArray(secrets)
    ? secrets.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  if (normalizedSecrets.length === 0) return null;

  const hasValidSignature = normalizedSecrets.some((secret) => {
    const expected = computePublicShareSignature({
      publicId: parsed.publicId,
      issuedAtEpochSeconds: parsed.issuedAtEpochSeconds,
      secret
    });
    return safeEqualHex(expected, parsed.signature);
  });

  if (!hasValidSignature) return null;

  return {
    publicId: parsed.publicId,
    issuedAtEpochSeconds: parsed.issuedAtEpochSeconds
  };
}

module.exports = {
  DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS,
  MAX_PUBLIC_SHARE_LINK_TTL_DAYS,
  createPublicShareToken,
  getPublicShareLinkExpiresAtEpochSeconds,
  getPublicShareLinkTtlDays,
  getPublicShareLinkTtlSeconds,
  isPublicShareLinkExpired,
  parsePublicShareToken,
  verifyPublicShareToken
};
