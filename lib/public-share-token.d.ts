export type ParsedPublicShareToken = {
  publicId: string;
  issuedAtEpochSeconds: number;
  signature: string;
};

export type VerifiedPublicShareToken = {
  publicId: string;
  issuedAtEpochSeconds: number;
};

export const DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS: number;
export const MAX_PUBLIC_SHARE_LINK_TTL_DAYS: number;

export function createPublicShareToken(params: {
  publicId: string;
  issuedAtEpochSeconds: number;
  secret: string;
}): string;

export function getPublicShareLinkExpiresAtEpochSeconds(
  issuedAtEpochSeconds: number,
  env?: NodeJS.ProcessEnv
): number | null;

export function getPublicShareLinkTtlDays(env?: NodeJS.ProcessEnv): number;

export function getPublicShareLinkTtlSeconds(env?: NodeJS.ProcessEnv): number;

export function isPublicShareLinkExpired(params: {
  issuedAtEpochSeconds: number;
  expiresAtEpochSeconds?: number;
  nowEpochSeconds?: number;
  env?: NodeJS.ProcessEnv;
}): boolean;

export function parsePublicShareToken(token: string): ParsedPublicShareToken | null;

export function verifyPublicShareToken(params: {
  token: string;
  secrets: string[];
}): VerifiedPublicShareToken | null;
