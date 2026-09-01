const DEFAULT_PERSONAL_PREMIUM_EMAIL = "ljcls@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return parseCsv(env.PREMIUM_FEATURE_USER_IDS);
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
