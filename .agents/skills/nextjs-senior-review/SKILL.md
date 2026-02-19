---
name: nextjs-senior-review
description: Run a periodic whole-codebase analysis for this Next.js/TypeScript repository with pragmatic architecture, security, and performance checks. Produce a concise prioritized report with code evidence (`path:line`) and practical fixes. Use for repository health audits, not only recent-diff reviews, including when there are no unstaged changes.
---

# Next.js Senior Review

Perform a pragmatic Staff+ audit of the full repository. Prioritize correctness, online-app safety, and user-perceived performance over style. Your job is surgical precision, not unsolicited renovation.


## Non-Negotiable Rules

- Prove each finding with `path:line` and a concrete risk explanation.
- List findings first, sorted by severity: `Blocker`, `High`, `Med`, `Low`.
- Avoid speculation. If uncertain, mark `incertain` and state how to verify.
- Stay actionable: maximum 10 findings and maximum 5 quick wins.
- Run available checks and report commands and outcomes.
- If no findings exist, state it explicitly and list residual risks or test gaps.
- Do not modify code by default. Apply quick wins only when explicitly asked.
- Never expose secrets in the report. If a key/token is found, cite only `path:line`, then recommend rotation and history cleanup.
- Don’t build over defensive code or extra catch.

- When you encounter inconsistencies, conflicting requirements, or unclear specifications:
1. STOP. Do not proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff and print the question in the final report.

- Before finishing any implementation, ask yourself:
1. Can this be done in fewer lines?
2. Are these abstractions earning their complexity?
3. Would a senior dev look at this and say "why didn't you just..."?

- After refactoring or implementing changes:
1. Identify code that is now unreachable
2. List it explicitly
3. Suggest deletion in the final report



## Severity Rubric

- `Blocker`: auth bypass, PII leak, data loss, RCE risk, or broken build/release path.
- `High`: sensitive endpoint authz weakness, plausible secret exposure, or realistically exploitable vulnerability.
- `Med`: incomplete validation/headers/caching or reliability issue with mitigations present.
- `Low`: low-risk improvement opportunity with limited production impact.

## Essential Inputs (Ask Only If Missing and Blocking)

Ask only these 3 questions when missing and required for risk assessment:

1. Deployment target (`Vercel`, self-hosted Node, other)
2. Auth provider/model
3. Data sensitivity level (PII, health-like data, etc.)

If answers are already inferable from repo context, do not ask and proceed.

## Default Scope

Analyze the repository as a whole by default. Do not depend on unstaged or staged changes.

If the user asks for a targeted scope, narrow to that scope. Otherwise audit core runtime paths plus infra/tooling paths.

## Baseline Quality Checks

Detect package manager and scripts from lockfiles + `package.json`.

Package manager selection order:

- `pnpm-lock.yaml` -> `pnpm`
- `yarn.lock` -> `yarn`
- `bun.lockb` or `bun.lock` -> `bun`
- `package-lock.json` -> `npm`
- fallback: `npm`

Run checks in this order when scripts exist:
- `lint` with warnings treated as errors (`<pm> run lint -- --max-warnings=0`)
- `typecheck` (or equivalent explicit type-check script)
- tests (`test`, then `test:e2e` when requested or when critical auth/routing/data risks are suspected)
- `build`
- `db:preflight` when `POSTGRES_URL` or `DATABASE_URL` is set

If a script is missing or skipped, state why.

## Audit Workflow

1. Build a quick system map:
   - App Router structure, server/client boundaries, route handlers, middleware
   - Auth flow, DB access layer, email/external integrations
   - Deployment/runtime assumptions from repo files
2. Run baseline checks and capture failures first.
3. Apply three audit lenses.
4. Produce a concise prioritized report with practical next steps.

## Audit Lenses

### A. Architecture

- Verify clear boundaries between UI, server logic, and data access.
- Detect tight coupling and hidden cross-layer dependencies.
- Evaluate error handling and observability paths for production diagnostics.
- Flag structural debt only when it has concrete runtime impact.

### B. Security (Pragmatic Baseline for an Online App)

- Focus on high-value risks: AuthN/AuthZ, secret exposure, unsafe inputs, session/reset-token handling, and dangerous redirects.
- Verify route handlers, server actions, and DB writes enforce authorization correctly.
- Verify Server/Client boundaries and `"use client"` placement to avoid leaking server-only logic to client bundles.
- Verify Server Actions follow secure practices (authorization, input validation, and safe invocation patterns).
- Prevent server-to-client leakage of secrets and server-only configuration, especially env usage and `NEXT_PUBLIC_` boundaries.
- Verify security headers and CSP strategy are coherent with the app architecture.
- Confirm migration and E2E safety rails prevent destructive misuse.
- Avoid overkill controls unless clearly justified by the app context.

### C. Performance (Practical Modern Next.js)

- Focus on user-perceived latency and server efficiency, not micro-optimizations.
- Check server/client split and avoid unnecessary client components.
- Identify fetch waterfalls and apply sensible caching/revalidation strategy.
- Flag obvious bundle bloat, heavy third-party scripts, and inefficient data paths.
- Prefer recent stable Next.js patterns when they reduce complexity or cost.

## Babymiam-Specific Priorities

Inspect these paths first:

- `app/` for route handlers, server actions, and auth-sensitive flows
- `components/` for server/client boundary mistakes
- `lib/` for DB access, auth/session logic, and runtime guards
- `migrations/` and `scripts/db/` for migration safety and operational guardrails
- `scripts/users/create-user.js` for account bootstrap behavior
- `tests/`, `playwright.config.ts`, `scripts/e2e/` for destructive test safety
- Env-sensitive logic in `.env.example`, `README.md`, and runtime config files

Pay special attention to:

- Migration safety flags: `SKIP_DB_SETUP`, `ALLOW_MIGRATE_SKIP`
- E2E DB reset safety: `E2E_ALLOW_REMOTE_DB_RESET`
- Production/CI DB URL guard behavior

## Output Format (Markdown)

- Top findings (<= 10): Severity, Evidence (`path:line`), Impact, Concrete fix
- Questions/hypotheses (<= 5)
- Executive summary (<= 6 bullets)
- Quick wins applicable now (<= 5)
- Follow-up plan (2-4 PRs max, pragmatic scope)

## After Report

Do not apply code changes automatically.
If explicitly asked to implement quick wins, keep total diff <= 200 LOC, use low-risk changes only, and validate with available checks.
