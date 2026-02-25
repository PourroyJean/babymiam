import type { AuthenticatedUser } from "@/lib/auth";

type PremiumFeatureKey = "pediatric_report_pdf";
const DEFAULT_TEST_PREMIUM_EMAIL = "ljcls@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(rawValue: string | undefined) {
  return new Set(
    String(rawValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function normalizeEmail(value: string | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

function shouldEnforcePremiumGating() {
  const mode = String(process.env.PREMIUM_GATE_MODE || "auto").trim().toLowerCase();
  if (mode === "off") return false;
  if (mode === "on") return true;
  return process.env.NODE_ENV === "production";
}

function getAllowedIdsForFeature(feature: PremiumFeatureKey) {
  if (feature === "pediatric_report_pdf") {
    const featureIds = parseCsv(process.env.PEDIATRIC_REPORT_PREMIUM_USER_IDS);
    if (featureIds.size > 0) return featureIds;
  }

  return parseCsv(process.env.PREMIUM_FEATURE_USER_IDS);
}

function getPersonalPremiumEmails() {
  const emails = new Set<string>([DEFAULT_TEST_PREMIUM_EMAIL]);
  const canonical = normalizeEmail(process.env.PERSONAL_ACCESS_EMAIL);

  if (canonical && isValidEmail(canonical)) {
    emails.add(canonical);
  }

  return emails;
}

function getAllowedEmailsForFeature(feature: PremiumFeatureKey) {
  const normalizedFeatureEmails =
    feature === "pediatric_report_pdf" ? parseCsv(process.env.PEDIATRIC_REPORT_PREMIUM_USER_EMAILS) : new Set<string>();
  const allowedEmails = new Set<string>();

  if (normalizedFeatureEmails.size > 0) {
    for (const email of normalizedFeatureEmails) {
      allowedEmails.add(email.toLowerCase());
    }
  } else {
    const globalEmails = parseCsv(process.env.PREMIUM_FEATURE_USER_EMAILS);
    if (globalEmails.size > 0) {
      for (const email of globalEmails) {
        allowedEmails.add(email.toLowerCase());
      }
    } else if (process.env.NODE_ENV !== "production") {
      // Keep a deterministic premium test user in non-production when no allowlist is configured.
      allowedEmails.add(DEFAULT_TEST_PREMIUM_EMAIL);
    }
  }

  for (const personalEmail of getPersonalPremiumEmails()) {
    allowedEmails.add(personalEmail);
  }

  return allowedEmails;
}

export function hasPremiumFeatureAccess(
  user: Pick<AuthenticatedUser, "id" | "email">,
  feature: PremiumFeatureKey
) {
  if (!shouldEnforcePremiumGating()) return true;

  const allowedIds = getAllowedIdsForFeature(feature);
  const allowedEmails = getAllowedEmailsForFeature(feature);

  const normalizedUserId = String(user.id);
  const normalizedEmail = String(user.email || "").trim().toLowerCase();

  if (allowedIds.has(normalizedUserId)) return true;
  if (normalizedEmail && allowedEmails.has(normalizedEmail)) return true;
  return false;
}
