"use server";

import { redirect } from "next/navigation";
import {
  createPublicShareAccessToken,
  createEmailVerificationToken,
  createSession,
  getAccountOverview,
  getUserPasswordHashById,
  hashPassword,
  requireAuth,
  requireVerifiedAuth,
  rotateSessionVersionForUser,
  updateUserPassword,
  validatePasswordPolicy,
  verifyPasswordHash
} from "@/lib/auth";
import { resolveAppBaseUrl } from "@/lib/app-url";
import {
  buildAccountPublicShareLink,
  createOrRotatePublicShareLink,
  getActivePublicShareLinkForOwner
} from "@/lib/data";
import { sendEmailVerificationEmail } from "@/lib/email";
import type { AccountPublicShareLink } from "@/lib/types";

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
  | {
      ok: true;
      userEmail: string;
      overview: Awaited<ReturnType<typeof getAccountOverview>>;
      publicShareLink: AccountPublicShareLink | null;
    }
  | { ok: false; error: "unknown" };

type PublicShareLinkActionResult =
  | { ok: true; publicShareLink: AccountPublicShareLink }
  | { ok: false; error: "unknown" };

function isModalAction(formData?: FormData | null) {
  return String(formData?.get("__mode") || "").trim() === "modal";
}

function getEpochSeconds(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed / 1000);
}

async function resolveAccountPublicShareLink(ownerId: number) {
  const link = await getActivePublicShareLinkForOwner(ownerId);
  if (!link) return null;

  const issuedAtEpochSeconds = getEpochSeconds(link.issuedAt);
  if (!issuedAtEpochSeconds) return null;

  const token = createPublicShareAccessToken({
    publicId: link.publicId,
    issuedAtEpochSeconds
  });

  return buildAccountPublicShareLink({
    baseUrl: resolveAppBaseUrl(),
    token,
    link
  });
}

export async function getAccountOverviewAction(): Promise<GetAccountOverviewActionResult> {
  const user = await requireAuth();

  try {
    const overview = await getAccountOverview(user.id);
    const publicShareLink =
      overview?.emailVerifiedAt ? await resolveAccountPublicShareLink(user.id) : null;

    return { ok: true, userEmail: user.email, overview, publicShareLink };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function generatePublicShareLinkAction(): Promise<PublicShareLinkActionResult> {
  const user = await requireVerifiedAuth();

  try {
    const link = await createOrRotatePublicShareLink(user.id);
    const issuedAtEpochSeconds = getEpochSeconds(link.issuedAt);
    if (!issuedAtEpochSeconds) {
      return { ok: false, error: "unknown" };
    }

    const token = createPublicShareAccessToken({
      publicId: link.publicId,
      issuedAtEpochSeconds
    });

    return {
      ok: true,
      publicShareLink: buildAccountPublicShareLink({
        baseUrl: resolveAppBaseUrl(),
        token,
        link
      })
    };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function regeneratePublicShareLinkAction(): Promise<PublicShareLinkActionResult> {
  const user = await requireVerifiedAuth();

  try {
    const link = await createOrRotatePublicShareLink(user.id, { forceRotate: true });
    const issuedAtEpochSeconds = getEpochSeconds(link.issuedAt);
    if (!issuedAtEpochSeconds) {
      return { ok: false, error: "unknown" };
    }

    const token = createPublicShareAccessToken({
      publicId: link.publicId,
      issuedAtEpochSeconds
    });

    return {
      ok: true,
      publicShareLink: buildAccountPublicShareLink({
        baseUrl: resolveAppBaseUrl(),
        token,
        link
      })
    };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function changePasswordAction(formData: FormData): Promise<ChangePasswordActionResult> {
  const modal = isModalAction(formData);
  const user = await requireVerifiedAuth();
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
  const user = await requireVerifiedAuth();

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
