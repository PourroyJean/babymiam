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

type ChangePasswordErrorCode =
  | "missing_fields"
  | "weak_password"
  | "password_mismatch"
  | "bad_password"
  | "unknown";

type ChangePasswordActionResult = { ok: true } | { ok: false; error: ChangePasswordErrorCode };

type SendVerificationEmailStatus = "sent" | "already_verified";
type SendVerificationEmailActionResult =
  | { ok: true; status: SendVerificationEmailStatus }
  | { ok: false; error: "unknown" };

type LogoutEverywhereActionResult = { ok: true } | { ok: false; error: "unknown" };

type GetAccountOverviewActionResult =
  | { ok: true; userEmail: string; overview: Awaited<ReturnType<typeof getAccountOverview>> }
  | { ok: false; error: "unknown" };

function isModalAction(formData?: FormData | null) {
  return String(formData?.get("__mode") || "").trim() === "modal";
}

export async function getAccountOverviewAction(): Promise<GetAccountOverviewActionResult> {
  const user = await requireAuth();

  try {
    const overview = await getAccountOverview(user.id);
    return { ok: true, userEmail: user.email, overview };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function changePasswordAction(formData: FormData): Promise<ChangePasswordActionResult> {
  const modal = isModalAction(formData);
  const user = await requireAuth();
  const currentPassword = String(formData.get("currentPassword") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !password || !confirmPassword) {
    if (modal) return { ok: false, error: "missing_fields" };
    redirect(buildAccountRedirect({ error: "missing_fields" }));
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    if (modal) return { ok: false, error: "weak_password" };
    redirect(buildAccountRedirect({ error: "weak_password" }));
  }

  if (password !== confirmPassword) {
    if (modal) return { ok: false, error: "password_mismatch" };
    redirect(buildAccountRedirect({ error: "password_mismatch" }));
  }

  let currentHash: string | null = null;
  try {
    currentHash = await getUserPasswordHashById(user.id);
  } catch {
    currentHash = null;
  }

  if (!currentHash) {
    if (modal) return { ok: false, error: "unknown" };
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  const isCurrentValid = await verifyPasswordHash(currentHash, currentPassword);
  if (!isCurrentValid) {
    if (modal) return { ok: false, error: "bad_password" };
    redirect(buildAccountRedirect({ error: "bad_password" }));
  }

  const newHash = await hashPassword(password);
  const sessionVersion = await updateUserPassword(user.id, newHash);
  if (!sessionVersion) {
    if (modal) return { ok: false, error: "unknown" };
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  await createSession(user.id, sessionVersion);
  if (modal) return { ok: true };
  redirect(buildAccountRedirect({ pw: "1" }));
}

export async function sendVerificationEmailAction(
  formData?: FormData
): Promise<SendVerificationEmailActionResult> {
  const modal = isModalAction(formData);
  const user = await requireAuth();

  let overview: Awaited<ReturnType<typeof getAccountOverview>> = null;
  try {
    overview = await getAccountOverview(user.id);
  } catch {
    overview = null;
  }

  if (!overview) {
    if (modal) return { ok: false, error: "unknown" };
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  if (overview.emailVerifiedAt) {
    if (modal) return { ok: true, status: "already_verified" };
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
    if (modal) return { ok: false, error: "unknown" };
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  if (modal) return { ok: true, status: "sent" };
  redirect(buildAccountRedirect({ verify_sent: "1" }));
}

export async function logoutEverywhereAction(
  formData?: FormData
): Promise<LogoutEverywhereActionResult> {
  const modal = isModalAction(formData);
  const user = await requireAuth();

  let nextSessionVersion = 0;
  try {
    nextSessionVersion = await rotateSessionVersionForUser(user.id);
  } catch {
    nextSessionVersion = 0;
  }

  if (!nextSessionVersion) {
    if (modal) return { ok: false, error: "unknown" };
    redirect(buildAccountRedirect({ error: "unknown" }));
  }

  await createSession(user.id, nextSessionVersion);
  if (modal) return { ok: true };
  redirect(buildAccountRedirect({ sessions: "1" }));
}
