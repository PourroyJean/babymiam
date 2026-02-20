"use server";

import { redirect } from "next/navigation";
import { verifyEmailWithToken } from "@/lib/auth";

export async function verifyEmailAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  if (!token) {
    redirect("/verify-email?status=invalid");
  }

  let verified = false;
  try {
    verified = await verifyEmailWithToken(token);
  } catch {
    verified = false;
  }

  redirect(verified ? "/verify-email?status=success" : "/verify-email?status=invalid");
}
