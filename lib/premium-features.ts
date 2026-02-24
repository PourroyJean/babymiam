import type { AuthenticatedUser } from "@/lib/auth";

type PremiumFeatureKey = "pediatric_report_pdf";

function parseCsv(rawValue: string | undefined) {
  return new Set(
    String(rawValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
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

function getAllowedEmailsForFeature(feature: PremiumFeatureKey) {
  const normalizedFeatureEmails =
    feature === "pediatric_report_pdf" ? parseCsv(process.env.PEDIATRIC_REPORT_PREMIUM_USER_EMAILS) : new Set<string>();

  if (normalizedFeatureEmails.size > 0) {
    return new Set([...normalizedFeatureEmails].map((value) => value.toLowerCase()));
  }

  const globalEmails = parseCsv(process.env.PREMIUM_FEATURE_USER_EMAILS);
  return new Set([...globalEmails].map((value) => value.toLowerCase()));
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
