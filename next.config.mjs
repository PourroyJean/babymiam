/** @type {import('next').NextConfig} */
const e2eDistDir = process.env.E2E_DIST_DIR?.trim();
const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
];

if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  });
}

const nextConfig = {
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
  async headers() {
    // `proxy.ts` already applies these headers on non-API routes.
    // Keep this rule for API endpoints to avoid duplicated policy definitions.
    return [
      {
        source: "/api/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
