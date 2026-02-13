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

async function getClientIpFromHeaders() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for") || "";
  const firstIp = forwarded.split(",")[0]?.trim();
  if (firstIp) return firstIp;

  const realIp = requestHeaders.get("x-real-ip") || "";
  return realIp.trim() || null;
}

export async function loginAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const clientIp = await getClientIpFromHeaders();

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
