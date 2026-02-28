import { isIP } from "node:net";

function trustProxyHeadersEnabled() {
  return process.env.TRUST_PROXY_IP_HEADERS === "1";
}

function normalizeIpCandidate(raw: string) {
  let candidate = raw.trim();
  if (!candidate) return null;

  if (candidate.toLowerCase().startsWith("for=")) {
    candidate = candidate.slice(4).trim();
  }

  candidate = candidate.replace(/^"+|"+$/g, "");
  candidate = candidate.replace(/^'+|'+$/g, "");

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (
    candidate.includes(".") &&
    candidate.includes(":") &&
    candidate.indexOf(":") === candidate.lastIndexOf(":")
  ) {
    candidate = candidate.slice(0, candidate.indexOf(":"));
  }

  if (candidate.startsWith("::ffff:")) {
    candidate = candidate.slice("::ffff:".length);
  }

  if (candidate.includes("%")) {
    candidate = candidate.split("%")[0];
  }

  return isIP(candidate) > 0 ? candidate : null;
}

function getRightMostValidIp(candidates: string[]) {
  // Read from right to reduce spoofing risk when upstream appends proxy chain values.
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeIpCandidate(candidates[index]);
    if (normalized) return normalized;
  }

  return null;
}

function getIpFromForwardedFor(value: string) {
  const candidates = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return getRightMostValidIp(candidates);
}

function getIpFromForwardedHeader(value: string) {
  const forDirectives = value
    .split(",")
    .flatMap((entry) => entry.split(";"))
    .map((entry) => entry.trim())
    .filter((entry) => entry.toLowerCase().startsWith("for="));

  return getRightMostValidIp(forDirectives);
}

export function getTrustedClientIpFromHeaders(requestHeaders: Headers) {
  if (!trustProxyHeadersEnabled()) return null;

  const forwardedFor = requestHeaders.get("x-forwarded-for") || "";
  const fromForwardedFor = getIpFromForwardedFor(forwardedFor);
  if (fromForwardedFor) return fromForwardedFor;

  const realIp = normalizeIpCandidate(requestHeaders.get("x-real-ip") || "");
  if (realIp) return realIp;

  const forwardedHeader = requestHeaders.get("forwarded") || "";
  if (!forwardedHeader) return null;

  return getIpFromForwardedHeader(forwardedHeader);
}
