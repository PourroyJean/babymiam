import argon2 from "argon2";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool, query } from "@/lib/db";

export const COOKIE_NAME = "bb_session";

const DEV_FALLBACK_SECRET = "dev-only-secret-change-me";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_ROTATE_THRESHOLD_SECONDS = 15 * 24 * 60 * 60;
const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
const PASSWORD_RESET_DEFAULT_TTL_MINUTES = 60;
const SIGNUP_RATE_LIMIT_WINDOW_MINUTES = 30;
const SIGNUP_RATE_LIMIT_MAX_FAILURES = 5;
const EMAIL_VERIFICATION_DEFAULT_TTL_MINUTES = 3 * 24 * 60;

type SessionPayload = {
  uid: number;
  sv: number;
  iat: number;
  exp: number;
};

export type AuthenticatedUser = {
  id: number;
  email: string;
  sessionVersion: number;
  status: string;
};

export type AccountOverview = {
  id: number;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

function getSessionSecrets() {
  const fromList = (process.env.AUTH_SECRETS || "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);

  if (fromList.length > 0) return fromList;

  const single = process.env.AUTH_SECRET?.trim();
  if (single) return [single];

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET or AUTH_SECRETS must be set in production.");
  }

  return [DEV_FALLBACK_SECRET];
}

function getPrimarySessionSecret() {
  return getSessionSecrets()[0];
}

function signWithSecret(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function sign(value: string) {
  return signWithSecret(value, getPrimarySessionSecret());
}

function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(serialized: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(serialized, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<SessionPayload>;

    const uid = Number(parsed.uid);
    const sv = Number(parsed.sv);
    const iat = Number(parsed.iat);
    const exp = Number(parsed.exp);

    if (!Number.isInteger(uid) || uid <= 0) return null;
    if (!Number.isInteger(sv) || sv <= 0) return null;
    if (!Number.isInteger(iat) || iat <= 0) return null;
    if (!Number.isInteger(exp) || exp <= iat) return null;

    return { uid, sv, iat, exp };
  } catch {
    return null;
  }
}

function buildSessionToken(payload: SessionPayload) {
  const serialized = encodePayload(payload);
  const signature = sign(serialized);
  return `${serialized}.${signature}`;
}

function parseSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [serialized, signature] = parts;
  const secrets = getSessionSecrets();

  const hasValidSignature = secrets.some((secret) =>
    safeEqualHex(signWithSecret(serialized, secret), signature)
  );

  if (!hasValidSignature) return null;
  return decodePayload(serialized);
}

async function setSessionCookie(payload: SessionPayload) {
  const token = buildSessionToken(payload);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(payload.exp * 1000)
  });
}

function getNowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function buildNewPayload(userId: number, sessionVersion: number): SessionPayload {
  const now = getNowEpochSeconds();
  return {
    uid: userId,
    sv: sessionVersion,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(`${token}:${getPrimarySessionSecret()}`).digest("hex");
}

function hashEmailVerificationToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(`email_verify:${token}:${getPrimarySessionSecret()}`)
    .digest("hex");
}

function generateResetTokenValue() {
  return crypto.randomBytes(32).toString("hex");
}

async function getUserById(userId: number): Promise<AuthenticatedUser | null> {
  const result = await query<{
    id: number;
    email: string;
    session_version: number;
    status: string;
  }>(
    `
      SELECT id, email::text AS email, session_version, status
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    email: row.email,
    sessionVersion: Number(row.session_version),
    status: row.status
  };
}

async function tryRotateSessionCookie(user: AuthenticatedUser, payload: SessionPayload) {
  const now = getNowEpochSeconds();
  const remainingSeconds = payload.exp - now;
  if (remainingSeconds > SESSION_ROTATE_THRESHOLD_SECONDS) return;

  const nextPayload = buildNewPayload(user.id, user.sessionVersion);

  try {
    await setSessionCookie(nextPayload);
  } catch {
    // Cookie writes can fail in read-only contexts (e.g. some server component flows).
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) return "L'email est obligatoire.";
  if (email.length > 254) return "L'email est trop long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Format d'email invalide.";
  }
  return null;
}

export function validatePasswordPolicy(value: string) {
  if (value.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }

  return null;
}

export async function hashPassword(value: string) {
  return argon2.hash(value, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPasswordHash(hash: string, candidate: string) {
  try {
    return await argon2.verify(hash, candidate);
  } catch {
    return false;
  }
}

export async function getUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const result = await query<{
    id: number;
    email: string;
    password_hash: string;
    session_version: number;
    status: string;
  }>(
    `
      SELECT id, email::text AS email, password_hash, session_version, status
      FROM users
      WHERE email = $1
      LIMIT 1;
    `,
    [normalizedEmail]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    email: row.email,
    passwordHash: row.password_hash,
    sessionVersion: Number(row.session_version),
    status: row.status
  };
}

export async function createUser(params: { email: string; passwordHash: string }) {
  const normalizedEmail = normalizeEmail(params.email);

  const result = await query<{ id: number; session_version: number }>(
    `
      INSERT INTO users (email, password_hash, status)
      VALUES ($1, $2, 'active')
      RETURNING id, session_version;
    `,
    [normalizedEmail, params.passwordHash]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create user.");
  }

  return {
    id: Number(row.id),
    sessionVersion: Number(row.session_version)
  };
}

export async function getAccountOverview(userId: number): Promise<AccountOverview | null> {
  const result = await query<{
    id: number;
    email: string;
    email_verified_at: string | null;
    created_at: string;
  }>(
    `
      SELECT
        id,
        email::text AS email,
        email_verified_at::text AS email_verified_at,
        created_at::text AS created_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at
  };
}

export async function getUserPasswordHashById(userId: number) {
  const result = await query<{ password_hash: string }>(
    `
      SELECT password_hash
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [userId]
  );

  return result.rows[0]?.password_hash || null;
}

export async function createSession(userId: number, sessionVersion: number) {
  await setSessionCookie(buildNewPayload(userId, sessionVersion));
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getOptionalAuthenticatedUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = parseSessionToken(token);
  if (!payload) return null;

  if (payload.exp <= getNowEpochSeconds()) return null;

  let user: AuthenticatedUser | null = null;
  try {
    user = await getUserById(payload.uid);
  } catch {
    return null;
  }

  if (!user) return null;
  if (user.status !== "active") return null;
  if (user.sessionVersion !== payload.sv) return null;

  await tryRotateSessionCookie(user, payload);
  return user;
}

export async function isAuthenticated() {
  const user = await getOptionalAuthenticatedUser();
  return user !== null;
}

export async function getAuthenticatedUser() {
  const user = await getOptionalAuthenticatedUser();
  if (!user) {
    try {
      await clearSession();
    } catch {
      // Ignore cookie write issues in read-only contexts.
    }
    redirect("/login");
  }

  return user;
}

export async function requireAuth() {
  return getAuthenticatedUser();
}

export async function recordLoginAttempt(emailNorm: string, ip: string | null, success: boolean) {
  await query(
    `
      INSERT INTO auth_login_attempts (email_norm, ip, success)
      VALUES ($1, NULLIF($2, '')::inet, $3);
    `,
    [emailNorm, ip || null, success]
  );
}

export async function isLoginRateLimited(emailNorm: string, ip: string | null) {
  const result = await query<{ failed_attempts: number }>(
    `
      SELECT COUNT(*)::int AS failed_attempts
      FROM auth_login_attempts
      WHERE success = false
        AND created_at > NOW() - ($3::text || ' minutes')::interval
        AND (
          email_norm = $1
          OR (NULLIF($2, '')::inet IS NOT NULL AND ip = NULLIF($2, '')::inet)
        );
    `,
    [emailNorm, ip || null, LOGIN_RATE_LIMIT_WINDOW_MINUTES]
  );

  return Number(result.rows[0]?.failed_attempts || 0) >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}

export async function recordSignupAttempt(emailNorm: string, ip: string | null, success: boolean) {
  await query(
    `
      INSERT INTO auth_signup_attempts (email_norm, ip, success)
      VALUES ($1, NULLIF($2, '')::inet, $3);
    `,
    [emailNorm, ip || null, success]
  );
}

export async function isSignupRateLimited(emailNorm: string, ip: string | null) {
  const result = await query<{ failed_attempts: number }>(
    `
      SELECT COUNT(*)::int AS failed_attempts
      FROM auth_signup_attempts
      WHERE success = false
        AND created_at > NOW() - ($3::text || ' minutes')::interval
        AND (
          email_norm = $1
          OR (NULLIF($2, '')::inet IS NOT NULL AND ip = NULLIF($2, '')::inet)
        );
    `,
    [emailNorm, ip || null, SIGNUP_RATE_LIMIT_WINDOW_MINUTES]
  );

  return Number(result.rows[0]?.failed_attempts || 0) >= SIGNUP_RATE_LIMIT_MAX_FAILURES;
}

export async function createPasswordResetToken(userId: number) {
  const token = generateResetTokenValue();
  const tokenHash = hashResetToken(token);
  const ttlMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES || PASSWORD_RESET_DEFAULT_TTL_MINUTES);

  await query(
    `
      DELETE FROM password_reset_tokens
      WHERE user_id = $1
         OR expires_at < NOW();
    `,
    [userId]
  );

  await query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + ($3::text || ' minutes')::interval);
    `,
    [userId, tokenHash, ttlMinutes]
  );

  return token;
}

export async function createEmailVerificationToken(userId: number) {
  const token = generateResetTokenValue();
  const tokenHash = hashEmailVerificationToken(token);
  const ttlMinutes = Number(
    process.env.EMAIL_VERIFICATION_TTL_MINUTES || EMAIL_VERIFICATION_DEFAULT_TTL_MINUTES
  );

  await query(
    `
      DELETE FROM email_verification_tokens
      WHERE user_id = $1
         OR expires_at < NOW();
    `,
    [userId]
  );

  await query(
    `
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + ($3::text || ' minutes')::interval);
    `,
    [userId, tokenHash, ttlMinutes]
  );

  return token;
}

export async function verifyEmailWithToken(token: string) {
  const tokenHash = hashEmailVerificationToken(token);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query<{ user_id: number }>(
      `
        UPDATE email_verification_tokens
        SET used_at = NOW()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING user_id;
      `,
      [tokenHash]
    );

    const userId = Number(tokenResult.rows[0]?.user_id || 0);
    if (!userId) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
        UPDATE users
        SET
          email_verified_at = COALESCE(email_verified_at, NOW()),
          updated_at = NOW()
        WHERE id = $1;
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM email_verification_tokens
        WHERE user_id = $1;
      `,
      [userId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and surface the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = hashResetToken(token);

  const result = await query<{ user_id: number }>(
    `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id;
    `,
    [tokenHash]
  );

  const row = result.rows[0];
  return row ? Number(row.user_id) : null;
}

export async function resetPasswordWithToken(token: string, newPasswordHash: string) {
  const tokenHash = hashResetToken(token);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query<{ user_id: number }>(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING user_id;
      `,
      [tokenHash]
    );

    const userId = Number(tokenResult.rows[0]?.user_id || 0);
    if (!userId) {
      await client.query("ROLLBACK");
      return false;
    }

    const userResult = await client.query<{ session_version: number }>(
      `
        UPDATE users
        SET
          password_hash = $2,
          session_version = session_version + 1,
          password_changed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING session_version;
      `,
      [userId, newPasswordHash]
    );

    const sessionVersion = Number(userResult.rows[0]?.session_version || 0);
    if (!sessionVersion) {
      throw new Error("Failed to update user password during reset.");
    }

    await client.query(
      `
        DELETE FROM password_reset_tokens
        WHERE user_id = $1;
      `,
      [userId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and surface the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUserPassword(userId: number, newPasswordHash: string) {
  const result = await query<{ session_version: number }>(
    `
      UPDATE users
      SET
        password_hash = $2,
        session_version = session_version + 1,
        password_changed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING session_version;
    `,
    [userId, newPasswordHash]
  );

  const sessionVersion = Number(result.rows[0]?.session_version || 0);

  await query(
    `
      DELETE FROM password_reset_tokens
      WHERE user_id = $1;
    `,
    [userId]
  );

  return sessionVersion;
}

export async function getSessionVersionForUser(userId: number) {
  const result = await query<{ session_version: number }>(
    `
      SELECT session_version
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [userId]
  );

  return Number(result.rows[0]?.session_version || 0);
}

export async function rotateSessionVersionForUser(userId: number) {
  const result = await query<{ session_version: number }>(
    `
      UPDATE users
      SET
        session_version = session_version + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING session_version;
    `,
    [userId]
  );

  return Number(result.rows[0]?.session_version || 0);
}
