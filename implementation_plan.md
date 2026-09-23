# Active implementation plan

This is Hexframe's current/future process-convergence queue under WG-ARCH-001 §27. The previous implementation wave is complete; this queue covers only remaining cross-repository normalization work. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags, releases, deployment state and the current organization baseline before editing. Take only the first open task unless the owner explicitly changes priority. Each delivering merge removes its own task and keeps later scope current. Delete this file in the final delivery; Git/GitHub retain completed history.

Hexframe already has the shared Node/npm baseline, canonical `npm run check`, protected/current `main`, required CI, squash-only controlled merges, automatic completed-branch deletion, repository-settings verify/apply commands, immutable `v*` tag rules, annotated-tag release validation, GitHub Release publication and protected Cloudflare production deployment. This wave must preserve those controls while converging the remaining release-identity CLI, tagging, publication and deploy differences with the other active repositories. Do not rebuild working infrastructure merely for cosmetic sameness.

## Open tasks

### HF-139 — [REFACTOR] Give release identity one reusable CLI owner

- Dependency: HF-138.
- Why: Release and deploy workflows currently duplicate annotated-tag, package-version and checked-out-commit shell validation. The normalized process should have one tested repository implementation that local checks and workflows call.
- Scope: Extract release identity into a credential-free script with explicit npm command(s), including exact annotated semantic tag, `package.json` version and tagged-commit checks. Replace duplicated YAML logic with calls to that one implementation while preserving the existing immutable-tag and dirty/development identity behavior.
- Non-goals: No tag creation, GitHub Release publication or production mutation.
- Acceptance: One repository CLI is authoritative for release identity; Release and Deploy do not carry separate implementations of the same tag/package/commit logic.
- Validation: pure/disposable Git cases; `npm run check`; workflow-structure checks as needed; `git diff --check`.
- Authorities: release identity script/tests, `docs/RELEASE-MANAGEMENT.md`, Release and Deploy workflows.

### HF-140 — [TEST] Guard the annotated tag and GitHub Release handoff

- Dependency: HF-139.
- Why: Hexframe already publishes with `gh release create --verify-tag`, but the tagging/publication path should be executable and structurally guarded the same way as the normalized repositories.
- Scope: Add deterministic cases and workflow validation proving that lightweight tags, malformed versions, package/tag mismatches, wrong tagged commits and non-tag refs cannot reach publication; require a valid annotated `vX.Y.Z` exact-head tag, clean `npm ci`, canonical `npm run check`, release-identity verification and `gh release create --verify-tag` before deployment can begin.
- Non-goals: Do not create a production release solely to satisfy this task.
- Acceptance: Canonical acceptance detects structural regressions in the tag-to-GitHub-Release path without credentials or provider mutation.
- Validation: release-workflow cases; release-identity cases; `npm run check`; `git diff --check`.
- Authorities: `.github/workflows/release.yml`, release identity CLI/tests, GitHub Release policy.

### HF-141 — [BUILD] Put production deployment behind one guarded npm CLI

- Dependency: HF-140.
- Why: The current protected deploy workflow invokes Wrangler production mutation inline while local `deploy:dry-run` uses repository code. Cross-repo CLI parity should give production deployment one repository-owned command without making local arbitrary production mutation possible.
- Scope: Extend the existing deploy implementation so the workflow invokes one npm-owned production command that fails closed unless it is running in the validated GitHub release/tag context with the expected release identity and credentials. Keep `deploy:dry-run` non-mutating. Move only deployment mechanics into the script; GitHub environment protection, secrets and workflow ordering remain provider controls.
- Non-goals: No manual/local production escape hatch, no deployment from branches or arbitrary `main`, no secret relocation.
- Acceptance: Production mutation is reachable only through the protected release workflow and exact release tag; the workflow no longer owns an independent inline Wrangler-deploy implementation.
- Validation: deploy CLI unit/case coverage; dry run; `npm run check`; exact workflow tests; `git diff --check`.
- Authorities: deploy script/package commands, Release/Deploy workflows, production environment policy.

### HF-142 — [TEST] Prove release-to-deploy identity end to end

- Dependency: HF-141.
- Why: The final deploy contract should be guarded as a chain, not merely as individually plausible workflow steps.
- Scope: Add credential-free workflow/contract tests proving production deploy depends on successful GitHub Release publication, uses the same immutable tag and commit, runs in the protected production environment, confirms the uploaded Cloudflare Version ID is serving 100% of traffic, and checks public `version.json` identity when the edge permits it. Preserve the authenticated provider check as authoritative when a Cloudflare challenge blocks public evidence.
- Non-goals: No WAF change and no requirement to perform a live production deploy in ordinary PR acceptance.
- Acceptance: Structural or identity drift between tag, GitHub Release, deploy checkout, Cloudflare deployment and public build identity fails canonical acceptance.
- Validation: workflow contract cases; `npm run check`; `git diff --check`; provider evidence only when a real release is intentionally exercised.
- Authorities: release/deploy workflow contracts, version stamp/build identity, Cloudflare deployment evidence policy.

### HF-143 — [DOCS] Complete shared process parity acceptance

- Dependency: HF-142.
- Why: The wave should finish from fresh repository/provider evidence instead of assuming earlier tasks still describe current state.
- Scope: Re-audit Hexframe against the active organization baseline across npm/toolchain, canonical commands, controlled history, squash-only merge/provider policy, GitHub settings CLI, immutable tagging, release identity, GitHub Release authority, production deploy gating and post-deploy identity. Reconcile only current-state docs and remove obsolete duplicated process text. Delete `implementation_plan.md` in this delivery once all required evidence is green.
- Non-goals: No product feature, gameplay change or unrelated refactor.
- Acceptance: Fresh repository and provider evidence show the applicable shared process is aligned, no hidden alternative release/deploy path remains, and no implementation queue survives.
- Validation: `npm ci`; `npm run check`; `npm run audit:dependencies`; live settings verification; workflow contract checks; exact-head CI; `git diff --check`.
- Authorities: current repository state, live provider state and the current organization baseline.
