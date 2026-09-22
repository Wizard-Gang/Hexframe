# Active implementation plan

This is Hexframe's current/future process-parity wave under WG-ARCH-001 §27. On `do needful`, refresh `main`, open PRs, exact-head CI and settings; finish a green/current authoritative PR first, then deliver only the first open task. A blocked first task is not bypassed without owner direction. The delivering merge removes its own block and updates later blocks. Delete this file in the last delivery; Git/GitHub retain history. Keep the repository's merge-commit policy and strong tag-only release, protected production deployment, provider-version confirmation, settings tests, content/document security, and no checked-in changelog.

The current local `dev` path loads admin credentials from `.env` and passes their values to Wrangler as command-line `--var` arguments. Fix that exposure before broadening the local lifecycle. A normal task never deploys production. Each task has one primary outcome sized for a short web implementation turn.

## Open tasks

### HF-127 — [SEC] Keep local admin secrets out of process arguments

- Dependency: HF-126 merged on `main`.
- Why: `scripts/dev.mjs` passes `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` as Wrangler argv values, visible to process inspection.
- Scope: Give local Wrangler the required values through an ignored, access-restricted local secret channel; retain missing-value preflight and never echo values. Add a test that inspects the spawned argument vector.
- Non-goals: No provider secret mutation, production config change, or full dev-lifecycle redesign.
- Acceptance: No local admin secret value appears in process arguments or logs; `dev` still starts with valid local configuration.
- Validation: Focused dev-secret tests; `npm run check`; local smoke with test-only values; `git diff --check`.
- Authorities: `scripts/dev.mjs`, `scripts/env.mjs`, `.gitignore`, `SECURITY.md`.

### HF-128 — [SEC] Resolve the current high-severity dependency advisories

- Dependency: HF-127 merged.
- Why: A fresh `npm ci`/`npm audit` reports high-severity `sharp` through Miniflare/Wrangler; an open dependency PR is not current/green under the controlled title gate.
- Scope: Update only the affected dependency/lockfile chain to a reviewed non-vulnerable compatible version, considering the open dependency PR as evidence rather than assuming it can merge; retain install-script policy.
- Non-goals: No app feature, provider mutation or unrelated dependency sweep.
- Acceptance: `npm audit --audit-level=high` is clear, and existing `check`/Worker dry run still pass.
- Validation: `npm ci`; `npm audit --audit-level=high`; `npm run check`; `git diff --check`.
- Authorities: `package.json`, package lock, `.npmrc`.

### HF-129 — [DOCS] Document Hexframe's command and capability map

- Dependency: HF-128 merged.
- Why: README/CONTRIBUTING give commands but not a clear distinction among credential-free `check`, live settings verification, local `dev`, dry-run deploy, and immutable release/deploy.
- Scope: Add a concise command table with actual prerequisites and side effects, including current extra CI whitespace/secret gates and the local secret channel.
- Non-goals: No script or workflow behavior change.
- Acceptance: A fresh agent can choose the correct local, acceptance, provider and release command without treating dry-run as production mutation.
- Validation: Compare docs with `package.json`/workflows; `npm run check`; `git diff --check`.
- Authorities: `README.md`, `CONTRIBUTING.md`, WG-ARCH-001 §27.

### HF-130 — [TEST] Prove checkout ownership for local dev cleanup

- Dependency: HF-129 merged.
- Why: Current `dev` is a blocking build-plus-Wrangler command with no testable process ownership boundary.
- Scope: Add a pure ownership decision and focused cases for this checkout's Wrangler child, stale PID and foreign process; do not change live cleanup yet.
- Non-goals: No port killing, reset, browser opening or production action.
- Acceptance: Unproven processes are rejected by the helper that later lifecycle cleanup will use.
- Validation: Focused ownership tests; `npm run check`; `git diff --check`.
- Authorities: `scripts/dev.mjs`, dev tests.

### HF-131 — [FIX] Clean up owned local Wrangler processes on exit

- Dependency: HF-130 merged.
- Why: A terminated `dev` wrapper can leave descendants after the synchronous Wrangler invocation.
- Scope: Use the tested ownership boundary to stop this checkout's local process tree on interrupt, termination and startup failure; report a foreign occupied port instead of killing its owner.
- Non-goals: No reset, browser open or deploy.
- Acceptance: Local stop leaves no owned descendant and does not signal an unrelated listener.
- Validation: Focused lifecycle tests; local `npm run dev` start/stop; `npm run check`; `git diff --check`.
- Authorities: `scripts/dev.mjs`, `scripts/env.mjs`.

### HF-132 — [BUILD] Add an explicit network-advisory CI gate

- Dependency: HF-131 merged.
- Why: `check` covers source, content, release boundary and pure settings, but CI has no dependency-advisory query.
- Scope: Add a named high-severity lockfile advisory command in CI and local docs; distinguish findings from unavailable registry network, without making cloud-offline `check` claim a query occurred.
- Non-goals: No dependency upgrades or runtime network requirement.
- Acceptance: CI fails on high-severity advisories; unavailable network is reported honestly.
- Validation: Audit command with network; `npm run check`; `git diff --check`.
- Authorities: `package.json`, `.github/workflows/ci.yml`, `SECURITY.md`.

### HF-133 — [BUILD] Reproduce the release with canonical `check`

- Dependency: HF-132 merged.
- Why: Tag workflow manually runs typecheck/test/build instead of the full `check` that also guards documents, content, security and release boundaries.
- Scope: Run `npm run check` on the exact annotated tag after `npm ci`, replacing only the duplicate subset; preserve identity preflight, GitHub Release publication and tag-only deploy caller.
- Non-goals: No release or deploy in this task.
- Acceptance: A tagged state must pass the same credential-free acceptance gate as a PR before publication.
- Validation: Focused workflow test; `npm run check`; `git diff --check`.
- Authorities: `.github/workflows/release.yml`, `scripts/validate-release-boundary.mjs`.

### HF-134 — [BUILD] Make build identity reproducible from immutable inputs

- Dependency: HF-133 merged.
- Why: `scripts/version-stamp.mjs` writes wall-clock `builtAt` and falls back to the nearest tag, so identical source builds can produce different identity files.
- Scope: Derive build metadata from the exact commit/tag or a documented deterministic source epoch; retain a truthful dirty local identity and current public version shape where required.
- Non-goals: No release publication, version bump or deployment.
- Acceptance: Two clean builds of the same checkout produce byte-identical identity artifacts; a dirty checkout is not labeled as the exact release.
- Validation: Focused stamp test; `npm run build` twice with comparison; `npm run check`; `git diff --check`.
- Authorities: `scripts/version-stamp.mjs`, build/version tests.

### HF-135 — [TEST] Give PR patch integrity one acceptance owner

- Dependency: HF-134 merged.
- Why: CI's PR-range whitespace step is correct but outside canonical `check`; local `check` cannot reproduce its result without base context.
- Scope: Add a small base-aware patch-integrity helper and wire it once into local/CI acceptance, preserving the exact PR range in CI.
- Non-goals: No merge-policy change or broad CI rewrite. Delete this plan in the delivering PR unless fresh future work is explicitly planned.
- Acceptance: Committed PR whitespace fails the same focused local/CI check, without duplicate execution.
- Validation: Focused helper cases; `npm run check`; `git diff --check`.
- Authorities: `.github/workflows/ci.yml`, `package.json`, `CONTRIBUTING.md`.

## Recheck after this wave

Re-audit `dev` readiness/headless-browser ergonomics and any remaining CI/test duplication from fresh state. Preserve the already strong release/deploy boundary rather than copying weaker scripts from another repository.
