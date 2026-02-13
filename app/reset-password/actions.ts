"use server";

import { redirect } from "next/navigation";
import { hashPassword, resetPasswordWithToken, validatePasswordPolicy } from "@/lib/auth";

function getResetErrorRedirect(token: string, reason: string) {
  const query = new URLSearchParams();
  query.set("error", reason);
  if (token) query.set("token", token);
  return `/reset-password?${query.toString()}`;
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!token) {
    redirect("/reset-password?error=invalid_token");
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    redirect(getResetErrorRedirect(token, "weak_password"));
  }

  if (password !== confirmPassword) {
    redirect(getResetErrorRedirect(token, "password_mismatch"));
  }

  let resetSucceeded = false;
  try {
    const passwordHash = await hashPassword(password);
    resetSucceeded = await resetPasswordWithToken(token, passwordHash);
  } catch {
    resetSucceeded = false;
  }

  if (!resetSucceeded) {
    redirect(getResetErrorRedirect("", "invalid_token"));
  }

  redirect("/login?reset=1");
}
