export type PremiumFeatureKey = "pediatric_report_pdf" | "anti_forget_radar";

export const PEDIATRIC_REPORT_FEATURE: PremiumFeatureKey;
export const ANTI_FORGET_RADAR_FEATURE: PremiumFeatureKey;
export function hasPremiumFeatureAccess(
  user: { id: string | number; email?: string | null },
  feature: PremiumFeatureKey,
  env?: Record<string, string | undefined>
): boolean;
