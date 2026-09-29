# Implementation plan

## Open tasks

### HF-165 — [FIX] Restore protected release credential handoff and publish v0.8.1

- Dependency: HF-164 queue publication and required advisory-gate recovery are merged.
- Why: The v0.8.0 Release reproduced and published but its reusable Deploy job received empty Cloudflare credential bindings, despite both named secrets existing in the protected `production` environment before the run. The Release caller omitted `secrets: inherit`; the production Worker still serves v0.7.9.
- Scope: Add the secret handoff to the Release caller while keeping the Deploy job inside the protected `production` environment. Add a release-to-deploy contract case that fails if the handoff is removed. Update release documentation to explain the credential boundary and the failed immutable v0.8.0 deployment. Bump `package.json` and the lockfile to 0.8.1 so the current-main release cutter can create a new annotated tag and dispatch the corrected Release workflow.
- Non-goals: Do not change Cloudflare secret values, the protected environment, provider DNS, tag rulesets, or the immutable v0.8.0 tag and GitHub Release. Do not add a local production deployment path.
- Acceptance: The release contract rejects a missing secret handoff; canonical validation and exact-head CI pass; the merged main commit automatically produces annotated v0.8.1 and an exact-tag Release run; after required production approval, Deploy verifies the uploaded Worker Version ID serves 100% and public `version.json` reports v0.8.1 at that tag's commit.
- Risk: High. The protected deployment mutates production and includes the v0.8.0 MVP storage deletion migration. A correction after deployment must move forward through another immutable patch release; v0.7.9 cannot restore deleted saves.
- Validation: Pinned `npm ci`; focused release/deploy contract tests; credential-free `npm run check`; `npm run audit:dependencies`; committed-range whitespace; exact-head required CI; post-merge CI; read-only live settings verification; Release and protected Deploy workflow evidence; public identity and browser checks.
- Authorities: `.github/workflows/release.yml`, `.github/workflows/deploy.yml`, `scripts/release-deploy-contract-cases.mjs`, `docs/RELEASE-MANAGEMENT.md`, `package.json`, `package-lock.json`.
