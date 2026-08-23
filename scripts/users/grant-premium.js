#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT_TAG = "[users:grant-premium]";
const TARGET_ENV_NAME = "PREMIUM_FEATURE_USER_EMAILS";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCsvEmails(rawValue) {
  const emails = String(rawValue || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);

  return new Set(emails);
}

function computeMergedEmails(existingCsv, newEmail) {
  const normalizedNewEmail = normalizeEmail(newEmail);
  const merged = parseCsvEmails(existingCsv);
  if (normalizedNewEmail) {
    merged.add(normalizedNewEmail);
  }

  return Array.from(merged).sort((left, right) => left.localeCompare(right)).join(",");
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();

  return {
    ...result,
    stdout,
    stderr
  };
}

function parseDotEnvValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  if (value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    return inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(content) {
  const values = new Map();
  const lines = String(content || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalizedLine = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const rawValue = normalizedLine.slice(separatorIndex + 1);
    values.set(key, parseDotEnvValue(rawValue));
  }

  return values;
}

function createSecureTempEnvPath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "grant-premium-"));
  const filename = `vercel-env-${crypto.randomBytes(8).toString("hex")}.env`;
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, "", { mode: 0o600 });
  return { tempDir, filePath };
}

function removeTempArtifacts({ tempDir, filePath }) {
  try {
    if (filePath) fs.rmSync(filePath, { force: true });
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function ensureVercelAuth() {
  const whoami = runCommand("vercel", ["whoami"]);
  if (whoami.error && whoami.error.code === "ENOENT") {
    throw new Error(`${SCRIPT_TAG} Vercel CLI not found. Install it first (npm i -g vercel).`);
  }

  if (whoami.status !== 0) {
    throw new Error(`${SCRIPT_TAG} Vercel CLI not authenticated. Run \`vercel login\` first.`);
  }
}

function pullProductionEnv() {
  const tempArtifacts = createSecureTempEnvPath();

  try {
    const pullResult = runCommand("vercel", [
      "env",
      "pull",
      tempArtifacts.filePath,
      "--environment",
      "production",
      "--yes"
    ]);

    if (pullResult.status !== 0) {
      const details = pullResult.stderr || pullResult.stdout || "Unknown error while running vercel env pull.";
      throw new Error(`${SCRIPT_TAG} Failed to read production env: ${details}`);
    }

    fs.chmodSync(tempArtifacts.filePath, 0o600);
    const fileContent = fs.readFileSync(tempArtifacts.filePath, "utf8");
    const envMap = parseEnvFile(fileContent);
    const hasTargetVar = envMap.has(TARGET_ENV_NAME);
    const existingCsv = hasTargetVar ? String(envMap.get(TARGET_ENV_NAME) || "") : "";

    return {
      hasTargetVar,
      existingCsv
    };
  } finally {
    removeTempArtifacts(tempArtifacts);
  }
}

function addProductionEnvVar(value) {
  const addResult = runCommand(
    "vercel",
    ["env", "add", TARGET_ENV_NAME, "production"],
    { input: `${value}\n` }
  );

  if (addResult.status !== 0) {
    const details = addResult.stderr || addResult.stdout || "Unknown error while running vercel env add.";
    throw new Error(`${SCRIPT_TAG} Failed to add ${TARGET_ENV_NAME}: ${details}`);
  }
}

function removeProductionEnvVar() {
  const rmResult = runCommand("vercel", ["env", "rm", TARGET_ENV_NAME, "production", "--yes"]);
  if (rmResult.status !== 0) {
    const details = rmResult.stderr || rmResult.stdout || "Unknown error while running vercel env rm.";
    throw new Error(`${SCRIPT_TAG} Failed to remove ${TARGET_ENV_NAME}: ${details}`);
  }
}

function isSuperset(candidateCsv, baselineCsv) {
  const candidate = parseCsvEmails(candidateCsv);
  const baseline = parseCsvEmails(baselineCsv);

  for (const value of baseline) {
    if (!candidate.has(value)) return false;
  }

  return true;
}

function assertPostWriteState({ oldCsv, targetEmail }) {
  const refreshed = pullProductionEnv();
  const newCsv = refreshed.existingCsv;
  const normalizedTarget = normalizeEmail(targetEmail);
  const refreshedSet = parseCsvEmails(newCsv);

  if (!isSuperset(newCsv, oldCsv) || !refreshedSet.has(normalizedTarget)) {
    console.error(`${SCRIPT_TAG} 🚨 POST-WRITE ASSERTION FAILED 🚨`);
    console.error(`${SCRIPT_TAG} Expected new value to include every old email and target email.`);
    console.error(`${SCRIPT_TAG} Target email: ${normalizedTarget}`);
    console.error(`${SCRIPT_TAG} OLD ${TARGET_ENV_NAME}: ${oldCsv || "<empty>"}`);
    console.error(`${SCRIPT_TAG} CURRENT ${TARGET_ENV_NAME}: ${newCsv || "<empty>"}`);
    throw new Error(`${SCRIPT_TAG} Post-write assertion failed. Manual restore may be required.`);
  }
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const positional = [];
  let dryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`${SCRIPT_TAG} Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length !== 1) {
    throw new Error(`${SCRIPT_TAG} Usage: node scripts/users/grant-premium.js <email> [--dry-run]`);
  }

  const email = normalizeEmail(positional[0]);
  if (!isValidEmail(email)) {
    throw new Error(`${SCRIPT_TAG} Invalid email format: ${JSON.stringify(positional[0])}`);
  }

  return { email, dryRun };
}

function runComputeMergedEmailsAssertions() {
  const sampleA = computeMergedEmails("a@x.com, B@Y.com", "new@z.com");
  if (sampleA !== "a@x.com,b@y.com,new@z.com") {
    throw new Error(`${SCRIPT_TAG} Internal check failed for sampleA. Got: ${sampleA}`);
  }

  const sampleB = computeMergedEmails("a@x.com, b@y.com", "B@Y.com");
  if (sampleB !== "a@x.com,b@y.com") {
    throw new Error(`${SCRIPT_TAG} Internal check failed for sampleB. Got: ${sampleB}`);
  }

  const sampleC = computeMergedEmails("  ", " New@Z.com ");
  if (sampleC !== "new@z.com") {
    throw new Error(`${SCRIPT_TAG} Internal check failed for sampleC. Got: ${sampleC}`);
  }
}

async function run(argv = process.argv.slice(2)) {
  const { email, dryRun } = parseArgs(argv);
  runComputeMergedEmailsAssertions();

  ensureVercelAuth();
  const current = pullProductionEnv();
  const mergedCsv = computeMergedEmails(current.existingCsv, email);

  console.log(`${SCRIPT_TAG} Target email: ${email}`);
  console.log(`${SCRIPT_TAG} Existing ${TARGET_ENV_NAME}: ${current.existingCsv || "<empty>"}`);
  console.log(`${SCRIPT_TAG} Computed new ${TARGET_ENV_NAME}: ${mergedCsv || "<empty>"}`);

  if (dryRun) {
    console.log(`${SCRIPT_TAG} DRY RUN — no changes written.`);
    return;
  }

  if (current.hasTargetVar) {
    removeProductionEnvVar();
  }
  addProductionEnvVar(mergedCsv);

  assertPostWriteState({ oldCsv: current.existingCsv, targetEmail: email });

  console.log(`${SCRIPT_TAG} ${TARGET_ENV_NAME} updated successfully.`);
  console.log("⚠️  Env var updated but NOT yet live — run `npm run deploy:prod` to activate this change.");
}

if (require.main === module) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${SCRIPT_TAG} Failed: ${message}`);
    process.exit(1);
  });
}

module.exports = {
  computeMergedEmails,
  parseCsvEmails
};
