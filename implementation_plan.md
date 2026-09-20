# Hexframe organization-normalization implementation plan

Status: active  
Baseline: WG-ARCH-001 §27

## Goal

Normalize Hexframe to the WizardGang product-repository baseline through small sequential controlled changes. This file is the live queue for current/future work only.

## Execution rules

- Pick up the first open task unless the user explicitly overrides the queue or a prerequisite blocks it.
- `do needful` means execute that first open task through implementation, validation, PR, successful merge, purge, and next-task handoff without asking which task to take.
- One task equals one controlled change and one PR.
- Do not begin a later task while its prerequisite PR is open.
- Preserve product behavior unless the task explicitly changes a platform or presentation contract.
- No task in this plan deploys production merely because it merges.
- Every task finishes with `npm run check`, any task-specific checks, and `git diff --check`.
- Merge the current PR when its current head is green, up to date, authoritative for the task, and mergeable.
- The merge that completes a task removes that task from this file. Do not keep completed tasks or legacy narrative here.
- Delete this file when no future planned tasks remain.
- After a successful merge/purge, the session must end with a copy-paste prompt to implement and land the next open task under these same rules. If no task remains, no follow-up prompt is required.

## Planned controlled changes

### [ ] HF-124 — OPS — Codify and apply GitHub repository settings

Make GitHub configuration match §27 and make expected settings reviewable in the repository.

Acceptance:
- add `config/github-repository-settings.json` (or equivalent) as the expected configuration;
- add a documented verifier that reads provider state without making `npm run check` require credentials;
- create a `main` ruleset requiring PRs and current CI checks and blocking force pushes/deletion;
- create an immutable `v*` tag ruleset;
- allow merge commits only; disable squash and rebase merges;
- enable deletion of merged head branches;
- verify `main` remains the default branch.

### [ ] HF-125 — TEST — Complete organization-baseline acceptance

Perform the final repository-wide acceptance pass against WG-ARCH-001 §27.

Acceptance:
- re-inventory the repository from current `main`;
- confirm toolchain, commands, presentation boundary, CSP, change control, release flow, repository contents, GitHub settings, and current-state docs match the standard;
- remove dead transitional code/config/docs revealed by the migration;
- ensure README, AGENTS, CONTRIBUTING, SECURITY, architecture, change-management, and release-management documentation agree;
- run `npm ci`, `npm run check`, repository-settings verification, and `git diff --check`;
- delete this implementation plan in the completing merge after its remaining work is delivered.

## Non-goals

This normalization does not redesign combat, rebalance game content, add new game modes, change save semantics, or create a production release by itself. Product changes discovered during normalization should receive later controlled IDs rather than being hidden inside baseline work.
