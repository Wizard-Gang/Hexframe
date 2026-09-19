# Hexframe organization-normalization implementation plan

Status: active  
Baseline: WG-ARCH-001 §27

## Goal

Normalize Hexframe to the WizardGang product-repository baseline through small sequential controlled changes. This file is the live queue for current/future work only.

## Execution rules

- Pick up the first open task unless the user explicitly overrides the queue or a prerequisite blocks it.
- One task equals one controlled change and one PR.
- Do not begin a later task while its prerequisite PR is open.
- Preserve product behavior unless the task explicitly changes a platform or presentation contract.
- No task in this plan deploys production merely because it merges.
- Every task finishes with `npm run check`, any task-specific checks, and `git diff --check`.
- Merge the current PR when its current head is green, up to date, authoritative for the task, and mergeable.
- The merge that completes a task removes that task from this file. Do not keep completed tasks or legacy narrative here.
- Delete this file when no future planned tasks remain.

## Planned controlled changes

### [ ] HF-118 — BUILD — Complete the baseline toolchain majors

Move the executable toolchain to the §27 major versions as one dependency-controlled change.

Acceptance:
- TypeScript 7 in strict mode;
- Vite 8;
- Vitest 5;
- align Node typings/tooling with Node 26 where required;
- retain Wrangler 4 and Workers Static Assets;
- update the lockfile and exact `allowScripts` entries to the locked dependency graph;
- `typecheck` covers every TypeScript program and no repository tooling depends on the TypeScript compiler API.

### [ ] HF-119 — REFACTOR — Establish React document rendering and the game client boundary

Adopt React 19 for document presentation while explicitly preserving Hexframe as an interactive browser game.

Acceptance:
- add React 19 and React DOM;
- render HTML documents from TSX at build time or on the server rather than maintaining hand-authored application shells as the presentation authority;
- make the public overview useful without JavaScript;
- keep interactive combat/training as an explicit client-application exception rather than pretending the game can operate without JavaScript;
- do not introduce client hydration or a client-side router merely for document rendering;
- record the document/client boundary in `docs/ARCHITECTURE.md`;
- keep styles as Vite-processed CSS files.

### [ ] HF-120 — SEC — Remove unsafe presentation injection

Bring the presentation security boundary into compliance after the React document foundation exists.

Acceptance:
- remove scattered application `innerHTML`/HTML-string rendering from public, Codex, and lab presentation paths;
- if raw HTML insertion remains technically necessary, confine it to one named, audited boundary with tests;
- remove `'unsafe-inline'` from the application CSP;
- prohibit inline event-handler attributes and uncontrolled inline styles/scripts;
- add regression tests for CSP and built-document restrictions;
- preserve keyboard, reduced-motion, semantic, and screen-reader behavior while refactoring.

### [ ] HF-121 — BUILD — Restrict production mutation to releases

Make the tag-driven workflow the only supported production mutation path.

Acceptance:
- remove or convert local production-deploy helpers to dry-run/read-only behavior;
- remove local production-secret push behavior from normal package commands;
- require annotated `v*` tags and verify the tag version equals `package.json#version`;
- keep production deployment behind the protected `production` environment;
- ensure deploy jobs operate only on the exact release tag/commit;
- remove manual paths that can deploy an arbitrary branch or unverified production state.

### [ ] HF-122 — BUILD — Make GitHub Releases the release-history authority

Retire checked-in parallel release history and generate releases from Git/GitHub state.

Acceptance:
- stop reading `docs/releases/v*.md` in `release.yml`;
- publish one GitHub Release for each annotated semantic-version tag using generated/current release information;
- delete `CHANGELOG.md` and `docs/releases/**`;
- rewrite `docs/RELEASE-MANAGEMENT.md` so tags and GitHub Releases are the release-history authority;
- update all references/tests that assume checked-in per-version Markdown.

### [ ] HF-123 — DOCS — Retire superseded historical repository records

Reduce repository documentation to current architecture/policy plus operating material that is still genuinely authoritative.

Acceptance:
- review and retire `docs/RECONSTRUCTION.md`, `docs/SHADOWMONEY-RETIREMENT.md`, and `docs/history/**` unless a surviving record is required by a current executable/operational contract;
- move no historical narrative into replacement Markdown;
- preserve any still-current security, architecture, migration, or data-retention fact in the correct current-state document before deleting its historical carrier;
- remove concrete obsolete change IDs, SHAs, retired-route narratives, and former implementation descriptions from current docs and workflow comments;
- repair all links and documentation tests.

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
