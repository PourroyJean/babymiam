export type DatabaseUrlSource =
  | "LOCAL_POSTGRES_URL"
  | "POSTGRES_URL"
  | "DATABASE_URL"
  | "local-default";

export type DatabaseUrlResolution = {
  databaseUrl: string;
  source: DatabaseUrlSource;
  strictRuntime: boolean;
};

export const DEFAULT_LOCAL_POSTGRES_URL: string;

export function getEnvValue(name: string, env?: NodeJS.ProcessEnv): string;

export function isStrictRuntime(env?: NodeJS.ProcessEnv): boolean;

export function normalizeConnectionString(value: string): string;

export function resolveDatabaseUrl(options?: {
  scriptName?: string;
  env?: NodeJS.ProcessEnv;
  allowLocalFallback?: boolean;
}): DatabaseUrlResolution;
