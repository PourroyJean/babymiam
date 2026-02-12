"use server";

import { redirect } from "next/navigation";
import { createSession, getConfiguredCredentials } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();

  const configured = getConfiguredCredentials();
  if (username !== configured.username || password !== configured.password) {
    redirect("/login?error=1");
  }

  createSession(username);
  redirect("/");
}
