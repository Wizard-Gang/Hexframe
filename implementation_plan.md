# Active implementation plan

This is Hexframe's current/future process-convergence queue under WG-ARCH-001 §27. The previous implementation wave is complete; this queue covers only remaining cross-repository normalization work. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags, releases, deployment state and the current organization baseline before editing. Take only the first open task unless the owner explicitly changes priority. Each delivering merge removes its own task and keeps later scope current. Delete this file in the final delivery; Git/GitHub retain completed history.

Hexframe already has the shared Node/npm baseline, canonical `npm run check`, protected/current `main`, required CI, squash-only controlled merges, automatic completed-branch deletion, repository-settings verify/apply commands, immutable `v*` tag rules, annotated-tag release validation, GitHub Release publication and protected Cloudflare production deployment, plus one tested release-identity CLI, a guarded repository-owned production deploy CLI, and credential-free release-workflow contract cases. This wave must preserve those controls while completing end-to-end release/deploy evidence and final parity acceptance. Do not rebuild working infrastructure merely for cosmetic sameness.

## Open tasks

### HF-142 — [TEST] Prove release-to-deploy identity end to end

- Dependency: The guarded production deploy CLI remains authoritative.
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
