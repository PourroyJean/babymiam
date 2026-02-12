import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "bb_session";
const DEFAULT_USER = "LJCLS";
const DEFAULT_PASSWORD = "LOULOU38";
const DEV_FALLBACK_SECRET = "dev-only-secret-change-me";

function getSecret() {
  const configuredSecret = process.env.AUTH_SECRET?.trim();
  if (configuredSecret) return configuredSecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.");
  }

  return DEV_FALLBACK_SECRET;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function buildToken(username: string) {
  const payload = `${username}:${Date.now()}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function getPayloadFromToken(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (sign(payload) !== signature) return null;
  return payload;
}

function getUsernameFromPayload(payload: string) {
  const separatorIndex = payload.lastIndexOf(":");
  if (separatorIndex <= 0) return null;

  const username = payload.slice(0, separatorIndex).trim();
  const issuedAtRaw = payload.slice(separatorIndex + 1);
  const issuedAt = Number(issuedAtRaw);

  if (!username || !Number.isFinite(issuedAt)) return null;
  return username;
}

function isValidToken(token: string | undefined) {
  return getPayloadFromToken(token) !== null;
}

export function getConfiguredCredentials() {
  return {
    username: process.env.AUTH_USER || DEFAULT_USER,
    password: process.env.AUTH_PASSWORD || DEFAULT_PASSWORD
  };
}

export async function isAuthenticated() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return isValidToken(token);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function getAuthenticatedUsername() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = getPayloadFromToken(token);
  if (!payload) {
    redirect("/login");
  }

  const username = getUsernameFromPayload(payload);
  if (!username) {
    redirect("/login");
  }

  return username;
}

export async function createSession(username: string) {
  const token = buildToken(username);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}
