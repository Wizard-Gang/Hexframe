# Active implementation plan

**Portfolio plan maintenance notice.** The owner may direct an additive update to this active queue while another task or pull request is in progress. Keep every existing open task and its order; a plan amendment neither implements nor retires it. After the shared policy setup, a routine amendment changes only this plan file. Before merging, re-fetch authoritative `main` and open pull requests, compare the current plan and exact head with the recorded base, and rebase/reconcile if either moved. Require current exact-head checks and mergeability so concurrent work is not overwritten. Any earlier “final task” or “no queue remains” wording applies to its original wave; it keeps this plan while appended tasks remain, and only the actual last task deletes it.

This is Hexframe's current/future process-convergence queue under WG-ARCH-001 §27. The previous implementation wave is complete; this queue covers only remaining cross-repository normalization work. On `do needful`, re-fetch authoritative `main`, open PRs, exact-head CI, repository settings, rulesets, tags, releases, deployment state and the current organization baseline before editing. Take only the first open task unless the owner explicitly changes priority. Each delivering merge removes its own task and keeps later scope current. Delete this file in the final delivery; Git/GitHub retain completed history.

Hexframe already has the shared Node/npm baseline, canonical `npm run check`, protected/current `main`, required CI, squash-only controlled merges, automatic completed-branch deletion, repository-settings verify/apply commands, immutable `v*` tag rules, annotated-tag release validation, GitHub Release publication and protected Cloudflare production deployment, plus one tested release-identity CLI, a guarded repository-owned production deploy CLI, and credential-free release-workflow and release-to-deploy contract cases. This wave must preserve those controls while completing end-to-end release/deploy evidence and final parity acceptance. Do not rebuild working infrastructure merely for cosmetic sameness.

## Open tasks

### HF-143 — [DOCS] Complete shared process parity acceptance

- Dependency: Release-to-deploy contract evidence is green.
- Why: The wave should finish from fresh repository/provider evidence instead of assuming earlier tasks still describe current state.
- Scope: Re-audit Hexframe against the active organization baseline across npm/toolchain, canonical commands, controlled history, squash-only merge/provider policy, GitHub settings CLI, immutable tagging, release identity, GitHub Release authority, production deploy gating and post-deploy identity. Reconcile only current-state docs and remove obsolete duplicated process text. Delete `implementation_plan.md` in this delivery once all required evidence is green.
- Non-goals: No product feature, gameplay change or unrelated refactor.
- Acceptance: Fresh repository and provider evidence show the applicable shared process is aligned, no hidden alternative release/deploy path remains, and no implementation queue survives.
- Validation: `npm ci`; `npm run check`; `npm run audit:dependencies`; live settings verification; workflow contract checks; exact-head CI; `git diff --check`.
- Authorities: current repository state, live provider state and the current organization baseline.

### HF-145 — [OPS] Normalize shared package, workflow, and npm command contracts

- Dependency: HF-143 delivered; portfolio planning policy HF-144 merged. Coordinate with the same normalization task in every public sibling repository.
- Why: Shared versioned tooling, workflow behavior, and npm command meanings have drifted across the public repositories.
- Scope: Inventory every public repository's direct and transitive shared npm packages, package manager, Node pin, lockfile, versioned vendor code, GitHub Action pins, workflow triggers/permissions/toolchain/install/check/advisory/identity/release/deploy steps, and npm scripts. Select one supported version for each shared vendor dependency or document a concrete compatibility exception. Align common scripts and YAML workflows to the same behavior for equivalent capabilities. Keep product-specific commands and explicit local-only/library/no-deploy boundaries. Reconcile AGENTS.md and the byte-identical CONTRIBUTING.md contract across the public set.
- Non-goals: Do not add unused packages, a hosted runtime to a local-only product, or production deployment merely for parity. Do not rewrite published history or unrelated product behavior.
- Acceptance: A fresh cross-repository matrix shows the same version for every shared versioned package/vendor tool where compatible, identical CONTRIBUTING.md bytes, equivalent workflow and npm-script semantics for applicable capabilities, and recorded exceptions with technical reasons. No workflow invokes a missing script; every package lock matches its manifest.
- Validation: Install each public repository with its pinned toolchain and `npm ci`; run `npm run check`, focused workflow/script contract tests, `git diff --check`, exact-head CI, and the separate network/provider gates where applicable. Re-fetch every target's base and this documentation commit before merging to preserve concurrent work.
