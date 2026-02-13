"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createPasswordResetToken, getUserByEmail, normalizeEmail } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

function resolveAppBaseUrl(requestHeaders: Headers) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  if (!host) return "http://127.0.0.1:3000";

  return `${protocol}://${host}`;
}

export async function forgotPasswordAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));

  if (!email) {
    redirect("/forgot-password?sent=1");
  }

  try {
    const user = await getUserByEmail(email);

    if (user && user.status === "active") {
      try {
        const token = await createPasswordResetToken(user.id);
        const requestHeaders = await headers();
        const baseUrl = resolveAppBaseUrl(requestHeaders);
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

        await sendPasswordResetEmail({ to: user.email, resetUrl });
      } catch {
        // Keep the response non-enumerating and resilient to email delivery errors.
      }
    }
  } catch {
    // Keep a non-enumerating response when database is unavailable.
  }

  redirect("/forgot-password?sent=1");
}
