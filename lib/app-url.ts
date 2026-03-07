let hasWarnedAboutVercelUrlFallback = false;

function normalizeAppBaseUrl(rawValue: string, source: "APP_BASE_URL" | "VERCEL_URL") {
  try {
    const parsed = new URL(rawValue);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`${source} must use http or https.`);
    }

    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${source} is invalid.`);
  }
}

export function resolveAppBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return normalizeAppBaseUrl(configured, "APP_BASE_URL");
  }

  const rawVercelUrl = process.env.VERCEL_URL?.trim();
  if (rawVercelUrl) {
    const normalizedHost = rawVercelUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!normalizedHost) {
      throw new Error("VERCEL_URL is invalid.");
    }

    if (!hasWarnedAboutVercelUrlFallback) {
      hasWarnedAboutVercelUrlFallback = true;
      console.warn(`[app-url] APP_BASE_URL missing; using VERCEL_URL fallback: https://${normalizedHost}`);
    }

    return normalizeAppBaseUrl(`https://${normalizedHost}`, "VERCEL_URL");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must be set in production.");
  }

  return "http://127.0.0.1:3000";
}
