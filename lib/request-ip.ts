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

function getIpFromForwardedFor(value: string) {
  const candidates = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeIpCandidate(candidate);
    if (normalized) return normalized;
  }

  return null;
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

  const forwardedParts = forwardedHeader
    .split(",")
    .flatMap((part) => part.split(";"))
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of forwardedParts) {
    const normalized = normalizeIpCandidate(part);
    if (normalized) return normalized;
  }

  return null;
}
