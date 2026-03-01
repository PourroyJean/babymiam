import { isIP } from "node:net";

const TRUST_PROXY_IP_HEADER_HOPS_DEFAULT = 1;

function trustProxyHeadersEnabled() {
  return process.env.TRUST_PROXY_IP_HEADERS === "1";
}

function getTrustedProxyIpHeaderHops() {
  const parsed = Number(process.env.TRUST_PROXY_IP_HEADER_HOPS || TRUST_PROXY_IP_HEADER_HOPS_DEFAULT);
  if (!Number.isFinite(parsed)) return TRUST_PROXY_IP_HEADER_HOPS_DEFAULT;

  const normalized = Math.trunc(parsed);
  if (normalized < 0 || normalized > 5) return TRUST_PROXY_IP_HEADER_HOPS_DEFAULT;
  return normalized;
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

function getTrustedClientIpFromCandidates(candidates: string[]) {
  let remainingTrustedHops = getTrustedProxyIpHeaderHops();
  let leftMostValidIp: string | null = null;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeIpCandidate(candidates[index]);
    if (!normalized) continue;

    leftMostValidIp = normalized;

    if (remainingTrustedHops === 0) {
      return normalized;
    }

    remainingTrustedHops -= 1;
  }

  return leftMostValidIp;
}

function getIpFromForwardedFor(value: string) {
  const candidates = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return getTrustedClientIpFromCandidates(candidates);
}

function getIpFromForwardedHeader(value: string) {
  const forDirectives = value
    .split(",")
    .flatMap((entry) => entry.split(";"))
    .map((entry) => entry.trim())
    .filter((entry) => entry.toLowerCase().startsWith("for="));

  return getTrustedClientIpFromCandidates(forDirectives);
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
