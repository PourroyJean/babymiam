"use server";

import { redirect } from "next/navigation";
import { createPasswordResetToken, getUserByEmail, normalizeEmail } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

function resolveAppBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("APP_BASE_URL must use http or https.");
      }

      parsed.pathname = "";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/$/, "");
    } catch {
      throw new Error("APP_BASE_URL is invalid.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must be set in production.");
  }

  return "http://127.0.0.1:3000";
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
        const baseUrl = resolveAppBaseUrl();
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
