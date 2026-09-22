# Active implementation plan

This is Hexframe's current/future process-parity wave under WG-ARCH-001 §27. On `do needful`, refresh `main`, open PRs, exact-head CI and settings; finish a green/current authoritative PR first, then deliver only the first open task. A blocked first task is not bypassed without owner direction. The delivering merge removes its own block and updates later blocks. Delete this file in the last delivery; Git/GitHub retain history. Keep the repository's merge-commit policy and strong tag-only release, protected production deployment, provider-version confirmation, settings tests, content/document security, and no checked-in changelog.

The next parity gap is release acceptance parity: make the immutable tag workflow reproduce canonical credential-free `check` before publication. A normal task never deploys production. Each task has one primary outcome sized for a short web implementation turn.

## Open tasks

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
