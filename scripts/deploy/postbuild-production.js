#!/usr/bin/env node

const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ALLOWED_VERCEL_DEPLOYMENT_ENVS = new Set(["production", "preview"]);

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function isVercelRuntime() {
  const raw = getEnv("VERCEL").toLowerCase();
  return raw === "1" || raw === "true";
}

function getVercelDeploymentEnv() {
  return getEnv("VERCEL_ENV").toLowerCase();
}

function shouldGenerateSharedTestLink(vercelEnv) {
  return ALLOWED_VERCEL_DEPLOYMENT_ENVS.has(vercelEnv);
}

function getMissingRequiredEnvKeys() {
  const missing = [];

  if (!getEnv("PERSONAL_ACCESS_EMAIL")) {
    missing.push("PERSONAL_ACCESS_EMAIL");
  }

  if (!getEnv("APP_BASE_URL")) {
    missing.push("APP_BASE_URL");
  }

  if (!getEnv("AUTH_SECRET") && !getEnv("AUTH_SECRETS")) {
    missing.push("AUTH_SECRET|AUTH_SECRETS");
  }

  if (!getEnv("POSTGRES_URL") && !getEnv("DATABASE_URL")) {
    missing.push("POSTGRES_URL|DATABASE_URL");
  }

  return missing;
}

function hydrateAppBaseUrlFromVercelUrlIfNeeded(vercelEnv) {
  if (getEnv("APP_BASE_URL")) {
    return;
  }

  const rawVercelUrl = getEnv("VERCEL_URL");
  if (!rawVercelUrl) {
    return;
  }

  const normalizedHost = rawVercelUrl
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (!normalizedHost) {
    return;
  }

  const inferredBaseUrl = `https://${normalizedHost}`;
  process.env.APP_BASE_URL = inferredBaseUrl;
  console.log(
    `[postbuild:shared-test-link] APP_BASE_URL missing; using VERCEL_URL fallback for ${vercelEnv}: ${inferredBaseUrl}`
  );
}

function runSharedTestLinkGeneration() {
  const scriptPath = path.resolve(__dirname, "../users/test-link-generate.js");
  execFileSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env
  });
}

function run() {
  if (!isVercelRuntime()) {
    console.log("[postbuild:shared-test-link] Skip shared test link generation (not running on Vercel).");
    return;
  }

  const vercelEnv = getVercelDeploymentEnv();
  if (!shouldGenerateSharedTestLink(vercelEnv)) {
    console.log(
      `[postbuild:shared-test-link] Skip shared test link generation (VERCEL_ENV=${JSON.stringify(vercelEnv)} is not preview/production).`
    );
    return;
  }

  hydrateAppBaseUrlFromVercelUrlIfNeeded(vercelEnv);

  const missing = getMissingRequiredEnvKeys();
  if (missing.length > 0) {
    console.warn(
      `[postbuild:shared-test-link] Skip shared test link generation (missing required environment variable(s): ${missing.join(", ")}).`
    );
    return;
  }

  console.log(
    `[postbuild:shared-test-link] Vercel ${vercelEnv} deployment detected. Generating shared test link...`
  );
  try {
    runSharedTestLinkGeneration();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[postbuild:shared-test-link] Shared test link generation failed: ${message}`);
    return;
  }
  console.log("[postbuild:shared-test-link] Shared test link generation completed.");
}

run();
