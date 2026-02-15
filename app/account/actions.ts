"use server";

import { redirect } from "next/navigation";
import {
  createEmailVerificationToken,
  createSession,
  getAccountOverview,
  getUserPasswordHashById,
  hashPassword,
  requireAuth,
  rotateSessionVersionForUser,
  updateUserPassword,
  validatePasswordPolicy,
  verifyPasswordHash
} from "@/lib/auth";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { sendEmailVerificationEmail } from "@/lib/email";

function buildAccountRedirect(query: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `/account?${suffix}` : "/account";
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireAuth();
  const currentPassword = String(formData.get("currentPassword") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !password || !confirmPassword) {
    redirect(buildAccountRedirect({ error: "missing_fields" }));
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    redirect(buildAccountRedirect({ error: "weak_password" }));
  }

  if (password !== confirmPassword) {
    redirect(buildAccountRedirect({ error: "password_mismatch" }));
  }

  let currentHash: string | null = null;
  try {
    currentHash = await getUserPasswordHashById(user.id);
  } catch {
    currentHash = null;
  }

  if (!currentHash) {
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  const isCurrentValid = await verifyPasswordHash(currentHash, currentPassword);
  if (!isCurrentValid) {
    redirect(buildAccountRedirect({ error: "bad_password" }));
  }

  const newHash = await hashPassword(password);
  const sessionVersion = await updateUserPassword(user.id, newHash);
  if (!sessionVersion) {
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  await createSession(user.id, sessionVersion);
  redirect(buildAccountRedirect({ pw: "1" }));
}

export async function sendVerificationEmailAction() {
  const user = await requireAuth();

  let overview: Awaited<ReturnType<typeof getAccountOverview>> = null;
  try {
    overview = await getAccountOverview(user.id);
  } catch {
    overview = null;
  }

  if (!overview) {
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  if (overview.emailVerifiedAt) {
    redirect(buildAccountRedirect({ already_verified: "1" }));
  }

  try {
    const token = await createEmailVerificationToken(user.id);
    const baseUrl = resolveAppBaseUrl();
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await sendEmailVerificationEmail({ to: overview.email, verifyUrl });
    } catch {
      // Email delivery is best-effort.
    }
  } catch {
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  redirect(buildAccountRedirect({ verify_sent: "1" }));
}

export async function logoutEverywhereAction() {
  const user = await requireAuth();

  let nextSessionVersion = 0;
  try {
    nextSessionVersion = await rotateSessionVersionForUser(user.id);
  } catch {
    nextSessionVersion = 0;
  }

  if (!nextSessionVersion) {
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  await createSession(user.id, nextSessionVersion);
  redirect(buildAccountRedirect({ sessions: "1" }));
}

