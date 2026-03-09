import type { AuthenticatedUser } from "@/lib/auth";
import { hasPremiumAccess as hasPremiumAccessCore } from "@/lib/premium-entitlement-core";

export function hasPremiumAccess(user: Pick<AuthenticatedUser, "id" | "email">) {
  return hasPremiumAccessCore(user, process.env);
}
