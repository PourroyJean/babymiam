import { NextRequest, NextResponse } from "next/server";
import { buildSessionCookie, verifySharedTestAccessToken } from "@/lib/auth";

function buildLoginErrorRedirect(request: NextRequest) {
  void request;
  return new NextResponse(null, {
    status: 302,
    headers: {
      location: "/login?error=1",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer"
    }
  });
}

function isDocumentNavigationRequest(request: NextRequest) {
  const fetchMode = String(request.headers.get("sec-fetch-mode") || "").toLowerCase();
  if (fetchMode && fetchMode !== "navigate") return false;

  const fetchDest = String(request.headers.get("sec-fetch-dest") || "").toLowerCase();
  if (fetchDest && fetchDest !== "document") return false;

  return true;
}

export async function GET(request: NextRequest) {
  if (!isDocumentNavigationRequest(request)) {
    return buildLoginErrorRedirect(request);
  }

  const token = String(request.nextUrl.searchParams.get("t") || "").trim();
  if (!token) {
    return buildLoginErrorRedirect(request);
  }

  try {
    const user = await verifySharedTestAccessToken(token);
    if (!user) {
      return buildLoginErrorRedirect(request);
    }

    const destination = user.emailVerifiedAt ? "/" : "/account?verify_required=1";
    const response = new NextResponse(null, {
      status: 302,
      headers: {
        location: destination,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer"
      }
    });
    const sessionCookie = buildSessionCookie(user.id, user.sessionVersion);
    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return response;
  } catch {
    return buildLoginErrorRedirect(request);
  }
}
