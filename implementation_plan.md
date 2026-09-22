# Active implementation plan

This is Hexframe's current/future process-parity wave under WG-ARCH-001 §27. On `do needful`, refresh `main`, open PRs, exact-head CI and settings; finish a green/current authoritative PR first, then deliver only the first open task. A blocked first task is not bypassed without owner direction. The delivering merge removes its own block and updates later blocks. Delete this file in the last delivery; Git/GitHub retain history. Keep the repository's merge-commit policy and strong tag-only release, protected production deployment, provider-version confirmation, settings tests, content/document security, and no checked-in changelog.

The next parity gap is PR patch-integrity ownership: make the exact committed PR range reproducible through one base-aware acceptance owner without duplicating CI execution. A normal task never deploys production. Each task has one primary outcome sized for a short web implementation turn.

## Open tasks

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
