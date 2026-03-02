const DEFAULT_PERSONAL_PREMIUM_EMAIL = "ljcls@gmail.com";
const PEDIATRIC_REPORT_FEATURE = "pediatric_report_pdf";
const ANTI_FORGET_RADAR_FEATURE = "anti_forget_radar";
const WEEKLY_DISCOVERY_PLAN_FEATURE = "weekly_discovery_plan";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FEATURE_ID_ALLOWLIST_ENV = {
  [PEDIATRIC_REPORT_FEATURE]: "PEDIATRIC_REPORT_PREMIUM_USER_IDS",
  [ANTI_FORGET_RADAR_FEATURE]: "ANTI_FORGET_RADAR_PREMIUM_USER_IDS",
  [WEEKLY_DISCOVERY_PLAN_FEATURE]: "WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_IDS"
};
const FEATURE_EMAIL_ALLOWLIST_ENV = {
  [PEDIATRIC_REPORT_FEATURE]: "PEDIATRIC_REPORT_PREMIUM_USER_EMAILS",
  [ANTI_FORGET_RADAR_FEATURE]: "ANTI_FORGET_RADAR_PREMIUM_USER_EMAILS",
  [WEEKLY_DISCOVERY_PLAN_FEATURE]: "WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_EMAILS"
};

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

function getAllowedIdsForFeature(feature, env = process.env) {
  const featureIds = parseCsv(env[FEATURE_ID_ALLOWLIST_ENV[feature] || ""]);
  if (featureIds.size > 0) return featureIds;
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

function getAllowedEmailsForFeature(feature, env = process.env) {
  const featureEmails = parseCsv(env[FEATURE_EMAIL_ALLOWLIST_ENV[feature] || ""]);
  const allowedEmails = new Set();

  if (featureEmails.size > 0) {
    for (const email of featureEmails) {
      allowedEmails.add(email.toLowerCase());
    }
  } else {
    const globalEmails = parseCsv(env.PREMIUM_FEATURE_USER_EMAILS);
    if (globalEmails.size > 0) {
      for (const email of globalEmails) {
        allowedEmails.add(email.toLowerCase());
      }
    } else if (String(env.NODE_ENV || "").trim().toLowerCase() !== "production") {
      allowedEmails.add(DEFAULT_PERSONAL_PREMIUM_EMAIL);
    }
  }

  for (const personalEmail of resolvePersonalPremiumEmails(env)) {
    allowedEmails.add(personalEmail);
  }

  return allowedEmails;
}

function hasPremiumFeatureAccess(user, feature, env = process.env) {
  if (!shouldEnforcePremiumGating(env)) return true;

  const allowedIds = getAllowedIdsForFeature(feature, env);
  const allowedEmails = getAllowedEmailsForFeature(feature, env);
  const normalizedUserId = String(user.id);
  const normalizedEmail = normalizeEmail(user.email);

  if (allowedIds.has(normalizedUserId)) return true;
  if (normalizedEmail && allowedEmails.has(normalizedEmail)) return true;
  return false;
}

module.exports = {
  ANTI_FORGET_RADAR_FEATURE,
  PEDIATRIC_REPORT_FEATURE,
  WEEKLY_DISCOVERY_PLAN_FEATURE,
  hasPremiumFeatureAccess
};
