export function hasPremiumAccess(
  user: { id: string | number; email?: string | null },
  env?: Record<string, string | undefined>
): boolean;
