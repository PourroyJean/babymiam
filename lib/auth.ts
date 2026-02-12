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

function isValidToken(token: string | undefined) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  return sign(payload) === signature;
}

export function getConfiguredCredentials() {
  return {
    username: process.env.AUTH_USER || DEFAULT_USER,
    password: process.env.AUTH_PASSWORD || DEFAULT_PASSWORD
  };
}

export function isAuthenticated() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return isValidToken(token);
}

export function requireAuth() {
  if (!isAuthenticated()) {
    redirect("/login");
  }
}

export function createSession(username: string) {
  const token = buildToken(username);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}
