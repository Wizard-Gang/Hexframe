# Hexframe agent workflow

These instructions apply to the entire repository.

## Read first

For controlled repository work, read these before editing:

1. `AGENTS.md`
2. `implementation_plan.md` when it exists
3. `CONTRIBUTING.md`
4. `docs/CHANGE-MANAGEMENT.md`
5. `docs/RELEASE-MANAGEMENT.md`
6. `docs/ARCHITECTURE.md` when architecture or presentation boundaries are involved

WG-ARCH-001 §27 is the organization repository baseline. Project-specific behavior may extend it, but a departure must be deliberate and documented rather than accidental.

## Implementation plan is the work queue

`implementation_plan.md` is a live current/future work queue, not a historical record.

- If it exists and has open tasks, pick up the first open task before inventing or starting unrelated follow-up work unless the user explicitly overrides the queue or a prerequisite blocks it.
- Treat task order and acceptance criteria as the scope boundary. Do not skip ahead because a later task looks easy.
- Keep future tasks accurate as discoveries change their scope or prerequisites.
- The merge that delivers a task must remove that task and any now-obsolete planning text from `implementation_plan.md`. Git/GitHub is the history.
- Do not add completed-task sections, merge SHAs, release notes, retrospectives, or legacy narratives to the plan.
- If no future tasks remain, delete `implementation_plan.md` in the final task instead of preserving an empty historical plan.
- After a task merges successfully and is purged from the plan, end the session with a copy-paste prompt for the next open task. That prompt must start from current `main`, read `AGENTS.md` and `implementation_plan.md`, implement only the first open task, purge it in the completing merge, run required validation, merge when green/current/authoritative, and end with the next handoff prompt. If no task remains, state that the plan was deleted and no follow-up prompt is needed.

`AGENTS.md` and `implementation_plan.md` describe only the current workflow and future work. Do not preserve superseded process or implementation history in either file.

## "Do needful" shorthand

For this project, the user command **"do needful"** is explicit authorization to execute the next queued repository task without asking which task to take.

When the user says `do needful`:

1. Read current `AGENTS.md` and `implementation_plan.md`.
2. Take the first open implementation-plan task unless the user explicitly names another task or a prerequisite blocks it.
3. Execute that task through the complete branch → implementation → validation → PR → green current-head CI → merge-commit flow.
4. Purge the delivered task from `implementation_plan.md` in the completing merge and keep later tasks current.
5. Confirm merged `main` and the new first open task.
6. End the session with the copy-paste prompt for that next open task.

Do not stop at planning, local completion, a pushed branch, or "PR ready" when the task can be completed and merged.

## Controlled-change discipline

Hexframe uses the `HF-###` namespace.

- Start from an up-to-date `main`.
- Reuse an existing branch or PR for the current ID instead of creating a duplicate.
- Otherwise use the next sequential ID and branch `hf-###-imperative-summary`.
- Work only the current controlled change. Do not begin a later planned ID in the same branch.
- Preserve unrelated or user-authored work. Never reset, clean, overwrite, or discard it to make the tree look clean.
- Keep the commit and PR title in the form `[HF-###] [TYPE] Imperative summary` using exactly one type allowed by `docs/CHANGE-MANAGEMENT.md`.

## Definition of done

A repository-changing task is not finished at "PR ready." Complete the delivery loop:

1. Inspect all modified, deleted, and untracked files and account for them.
2. Remove only task-created temporary artifacts.
3. Run the relevant focused tests while working.
4. Update `implementation_plan.md` so the pending merge will leave only current/future tasks.
5. Before committing, run:
   ```bash
   npm run check
   git diff --check
   ```
6. Commit all intended task changes with the controlled-change title and an appropriate change record.
7. Push the branch and open or update its pull request. Never push directly to `main`.
8. Re-fetch the PR head and CI state after the push.
9. If the PR's current head is green, up to date, authoritative for the current change, and mergeable, merge it with a merge commit. Do not stop merely because the next requested change is only one ID ahead.
10. Confirm the merge landed on `main`. The merged plan must no longer list the delivered task.
11. If another sequential prompt follows, start it only after the current merge is confirmed.
12. Report the merged PR and resulting `main` commit. If a blocker prevents completion, report the exact blocker without claiming completion.
13. After a successful merge/purge, finish the session with the copy-paste handoff prompt for the next open implementation-plan task.

Do not squash or rebase a controlled change into `main`.

## Validation and CI

`npm run check` is the credential-free repository validation command and CI runs it on pull requests and `main`. Add new credential-free validation to `check` rather than creating a parallel unofficial gate.

Dependency-changing work must also use `npm ci` against the committed lockfile before completion.

No green CI, no merge.

## Release and deployment boundary

Normal feature, fix, refactor, documentation, test, and build changes do not deploy production.

Production is an immutable release action:

```text
main -> annotated v* tag -> GitHub Release -> protected production workflow
```

Do not deploy from a branch or arbitrary `main` commit. Do not use local production mutation as a substitute for the release workflow. A task that intentionally changes release/deployment controls must still not deploy unless deployment is explicitly part of that controlled change.

## Documentation authority

Keep repository prose about the current system. Do not add a changelog, per-version Markdown release archive, or historical narrative to preserve information already carried by Git/GitHub.

Use:
- executable source/contracts for behavior;
- current architecture/policy docs for present design and rules;
- Git history, PRs, Actions, annotated tags, and GitHub Releases for superseded changes and releases;
- provider history for deployment/runtime evidence.

If required validation or provider state cannot be checked, leave recoverable work intact and state exactly what remains unverified.

Read-only reviews that change no repository files do not require a commit or PR.
