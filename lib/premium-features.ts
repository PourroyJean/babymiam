import type { AuthenticatedUser } from "@/lib/auth";
import { hasPremiumFeatureAccess as hasPremiumFeatureAccessCore } from "@/lib/premium-entitlement-core";
import type { PremiumFeatureKey } from "@/lib/premium-entitlement-core";

export function hasPremiumFeatureAccess(
  user: Pick<AuthenticatedUser, "id" | "email">,
  feature: PremiumFeatureKey
) {
  return hasPremiumFeatureAccessCore(user, feature, process.env);
}
