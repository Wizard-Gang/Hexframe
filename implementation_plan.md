# Implementation plan

## Open tasks

### HF-151 — [OPS] Enable verified repository auto-merge

- Dependency: HF-150 plan-only queue publication has merged; preserve the current protected-main, CI, release, and deployment authorities.
- Why: GitHub currently disallows per-PR auto-merge even though required exact-head checks and squash-only controls can safely gate it.
- Scope: Commit `allowAutoMerge: true` in the repository settings authority; compare live `allow_auto_merge` in the read-only verifier, apply only the committed setting through `apply:github-settings`, and add a pure drift case. Document that enabling repository auto-merge does not enroll individual PRs. Preserve the existing merge methods, strict current-with-main checks, bypass actors, automatic branch deletion, and immutable release tags. Retire this task into the shared permanent empty queue.
- Non-goals: Do not auto-enroll unrelated PRs, change required check names, create a release, deploy production, or alter game behavior.
- Acceptance: Focused tests reject disabled auto-merge; canonical check and exact-head CI pass; live `allow_auto_merge` is true after independent readback; squash-only/current-main protection and release tags remain unchanged; one HF-151 squash commit lands on main with green post-merge CI and branch cleanup.
- Validation: Pinned npm ci, focused settings cases, canonical credential-free check, separate advisory gate when applicable, committed-range whitespace check, exact-head required CI, live settings apply and verification, post-merge CI, history and branch cleanup.
- Authorities: AGENTS.md, README.md, config/github-repository-settings.json, scripts/github-repository-settings.mjs, current GitHub repository settings and rulesets.
