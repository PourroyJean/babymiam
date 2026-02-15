export function resolveAppBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("APP_BASE_URL must use http or https.");
      }

      parsed.pathname = "";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/$/, "");
    } catch {
      throw new Error("APP_BASE_URL is invalid.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must be set in production.");
  }

  return "http://127.0.0.1:3000";
}

