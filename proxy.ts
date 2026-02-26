import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/share",
  "/magic-login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/maintenance"
];

const PUBLIC_STATIC_PATHS = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/site.webmanifest"
]);
const SESSION_COOKIE_PATTERN = /^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/;

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isMaintenanceModeEnabled() {
  return String(process.env.MAINTENANCE_MODE || "").toLowerCase() === "true";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function createCspNonce() {
  const rawNonce = crypto.randomUUID();

  try {
    return btoa(rawNonce).replace(/=+/g, "");
  } catch {
    return rawNonce.replace(/-/g, "");
  }
}

function buildContentSecurityPolicy(nonce: string) {
  const scriptSources = ["'self'", `'nonce-${nonce}'`];
  if (!isProductionRuntime()) {
    // Keep local dev ergonomics compatible with Next.js HMR/runtime scripts.
    scriptSources.push("'unsafe-inline'", "'unsafe-eval'");
  }

  const connectSources = ["'self'", "https:"];
  if (!isProductionRuntime()) {
    connectSources.push("http:", "ws:", "wss:");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (isProductionRuntime()) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

function createPassthroughResponse(request: NextRequest, nonce: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  applySecurityHeaders(response, nonce);
  return response;
}

function createRedirectResponse(url: URL, nonce: string) {
  const response = NextResponse.redirect(url);
  applySecurityHeaders(response, nonce);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createCspNonce();

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/images/") || PUBLIC_STATIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const maintenanceMode = isMaintenanceModeEnabled();

  if (maintenanceMode && pathname !== "/maintenance") {
    const maintenanceUrl = new URL("/maintenance", request.url);
    return createRedirectResponse(maintenanceUrl, nonce);
  }

  if (!maintenanceMode && pathname === "/maintenance") {
    const homeUrl = new URL("/", request.url);
    return createRedirectResponse(homeUrl, nonce);
  }

  if (isPublicPath(pathname)) {
    return createPassthroughResponse(request, nonce);
  }

  const sessionCookie = request.cookies.get("bb_session")?.value;
  if (!sessionCookie || !SESSION_COOKIE_PATTERN.test(sessionCookie)) {
    const loginUrl = new URL("/login", request.url);
    return createRedirectResponse(loginUrl, nonce);
  }

  return createPassthroughResponse(request, nonce);
}

export const config = {
  matcher: ["/((?!api).*)"]
};
