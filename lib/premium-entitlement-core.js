const DEFAULT_PERSONAL_PREMIUM_EMAIL = "ljcls@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGACY_PREMIUM_ID_ENV_KEYS = [
  "PEDIATRIC_REPORT_PREMIUM_USER_IDS",
  "WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_IDS"
];
const LEGACY_PREMIUM_EMAIL_ENV_KEYS = [
  "PEDIATRIC_REPORT_PREMIUM_USER_EMAILS",
  "WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_EMAILS"
];

function parseCsv(rawValue) {
  return new Set(
    String(rawValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(value);
}

function shouldEnforcePremiumGating(env = process.env) {
  const mode = String(env.PREMIUM_GATE_MODE || "auto").trim().toLowerCase();
  if (mode === "off") return false;
  if (mode === "on") return true;
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function getAllowedIds(env = process.env) {
  const allowedIds = parseCsv(env.PREMIUM_FEATURE_USER_IDS);

  // Backward compatibility during the premium env cutover.
  for (const envKey of LEGACY_PREMIUM_ID_ENV_KEYS) {
    for (const id of parseCsv(env[envKey])) {
      allowedIds.add(id);
    }
  }

  return allowedIds;
}

function resolvePersonalPremiumEmails(env = process.env) {
  const emails = new Set([DEFAULT_PERSONAL_PREMIUM_EMAIL]);
  const canonical = normalizeEmail(env.PERSONAL_ACCESS_EMAIL);

  if (canonical && isValidEmail(canonical)) {
    emails.add(canonical);
  }

  return emails;
}

function getAllowedEmails(env = process.env) {
  const allowedEmails = new Set();

  const globalEmails = parseCsv(env.PREMIUM_FEATURE_USER_EMAILS);
  if (globalEmails.size > 0) {
    for (const email of globalEmails) {
      allowedEmails.add(email.toLowerCase());
    }
  } else if (String(env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    allowedEmails.add(DEFAULT_PERSONAL_PREMIUM_EMAIL);
  }

  for (const envKey of LEGACY_PREMIUM_EMAIL_ENV_KEYS) {
    for (const email of parseCsv(env[envKey])) {
      allowedEmails.add(email.toLowerCase());
    }
  }

  for (const personalEmail of resolvePersonalPremiumEmails(env)) {
    allowedEmails.add(personalEmail);
  }

  return allowedEmails;
}

function hasPremiumAccess(user, env = process.env) {
  if (!shouldEnforcePremiumGating(env)) return true;

  const allowedIds = getAllowedIds(env);
  const allowedEmails = getAllowedEmails(env);
  const normalizedUserId = String(user.id);
  const normalizedEmail = normalizeEmail(user.email);

  if (allowedIds.has(normalizedUserId)) return true;
  if (normalizedEmail && allowedEmails.has(normalizedEmail)) return true;
  return false;
}

module.exports = {
  hasPremiumAccess
};
