#!/usr/bin/env node

const { execFileSync, spawnSync } = require("node:child_process");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getBuildVersion() {
  return {
    commit: git(["rev-parse", "HEAD"]),
    date: git(["show", "-s", "--format=%cs", "HEAD"])
  };
}

function deploy() {
  const { commit, date } = getBuildVersion();
  const vercel = process.platform === "win32" ? "vercel.cmd" : "vercel";
  const result = spawnSync(
    vercel,
    [
      "deploy",
      ".",
      "--prod",
      "-y",
      "--build-env",
      `NEXT_PUBLIC_BUILD_COMMIT=${commit}`,
      "--build-env",
      `NEXT_PUBLIC_BUILD_COMMIT_DATE=${date}`
    ],
    { stdio: "inherit" }
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
}

deploy();
