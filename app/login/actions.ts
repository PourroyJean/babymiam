"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  getUserByEmail,
  isLoginRateLimited,
  normalizeEmail,
  recordLoginAttempt,
  verifyPasswordHash
} from "@/lib/auth";
import { getTrustedClientIpFromHeaders } from "@/lib/request-ip";

export async function loginAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const clientIp = getTrustedClientIpFromHeaders(await headers());

  if (!email || !password) {
    redirect("/login?error=1");
  }

  let loginSucceeded = false;

  try {
    if (await isLoginRateLimited(email, clientIp)) {
      await recordLoginAttempt(email, clientIp, false);
    } else {
      const user = await getUserByEmail(email);

      let success = false;
      if (user && user.status === "active") {
        success = await verifyPasswordHash(user.passwordHash, password);
      }

      await recordLoginAttempt(email, clientIp, success);

      if (user && success && user.status === "active") {
        await createSession(user.id, user.sessionVersion);
        loginSucceeded = true;
      }
    }
  } catch {
    loginSucceeded = false;
  }

  if (!loginSucceeded) {
    redirect("/login?error=1");
  }

  redirect("/");
}
