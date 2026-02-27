export type ParsedSharedTestLoginToken = {
  userId: number;
  issuedAtEpochSeconds: number;
  signature: string;
};

export type VerifiedSharedTestLoginToken = {
  userId: number;
  issuedAtEpochSeconds: number;
};

export const SHARED_TEST_LOGIN_TTL_SECONDS: number;

export function createSharedTestLoginToken(params: {
  userId: number;
  issuedAtEpochSeconds: number;
  secret: string;
}): string;

export function getSharedTestLoginTokenExpiresAtEpochSeconds(
  issuedAtEpochSeconds: number
): number | null;

export function isSharedTestLoginTokenExpired(params: {
  issuedAtEpochSeconds: number;
  nowEpochSeconds?: number;
}): boolean;

export function parseSharedTestLoginToken(token: string): ParsedSharedTestLoginToken | null;

export function verifySharedTestLoginToken(params: {
  token: string;
  secrets: string[];
}): VerifiedSharedTestLoginToken | null;
