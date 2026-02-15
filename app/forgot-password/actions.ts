"use server";

import { redirect } from "next/navigation";
import { createPasswordResetToken, getUserByEmail, normalizeEmail } from "@/lib/auth";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/email";

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
