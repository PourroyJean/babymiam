"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createEmailVerificationToken,
  createSession,
  createUser,
  hashPassword,
  isSignupRateLimited,
  normalizeEmail,
  recordSignupAttempt,
  validateEmail,
  validatePasswordPolicy
} from "@/lib/auth";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { sendEmailVerificationEmail } from "@/lib/email";
import { getTrustedClientIpFromHeaders } from "@/lib/request-ip";

function getSignupErrorRedirect(reason: string) {
  const query = new URLSearchParams();
  if (reason) query.set("error", reason);
  return `/signup?${query.toString()}`;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function signupAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const clientIp = getTrustedClientIpFromHeaders(await headers());

  const emailError = validateEmail(email);
  if (emailError) {
    redirect(getSignupErrorRedirect("invalid_email"));
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    redirect(getSignupErrorRedirect("weak_password"));
  }

  if (password !== confirmPassword) {
    redirect(getSignupErrorRedirect("password_mismatch"));
  }

  let rateLimited = false;
  try {
    rateLimited = await isSignupRateLimited(email, clientIp);
  } catch {
    rateLimited = false;
  }

  if (rateLimited) {
    try {
      await recordSignupAttempt(email, clientIp, false);
    } catch {
      // Rate limiting must not crash signup.
    }

    redirect(getSignupErrorRedirect("rate_limited"));
  }

  let user: { id: number; sessionVersion: number } | null = null;

  try {
    const passwordHash = await hashPassword(password);
    user = await createUser({ email, passwordHash });

    try {
      await recordSignupAttempt(email, clientIp, true);
    } catch {
      // Best-effort.
    }
  } catch (error) {
    try {
      await recordSignupAttempt(email, clientIp, false);
    } catch {
      // Best-effort.
    }

    if (isUniqueViolation(error)) {
      redirect(getSignupErrorRedirect("email_in_use"));
    }

    redirect(getSignupErrorRedirect("unknown"));
  }

  await createSession(user.id, user.sessionVersion);

  try {
    const token = await createEmailVerificationToken(user.id);
    const baseUrl = resolveAppBaseUrl();
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await sendEmailVerificationEmail({ to: email, verifyUrl });
  } catch {
    // Email verification is best-effort.
  }

  redirect("/");
}
