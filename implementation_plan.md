# Implementation plan

## Open tasks

### HF-167 — [DOCS] Clarify connected GitHub delivery guidance

**Goal**

Align the shared agent contract with the wording accepted in wizardgang-architecture-demo as DEMO-390.

**Scope**

- Update `AGENTS.md` to distinguish ordinary connected GitHub PR delivery from settings administration.
- Update the portfolio-contract hash for `AGENTS.md` in `scripts/check-portfolio-contract.mjs`.
- Preserve the controlled PR, exact-head CI, squash-merge, and post-merge verification requirements.

**Acceptance**

- The agent contract and hash match the accepted shared wording.
- Pinned local validation and the separate dependency advisory gate pass.
- The task retires through one controlled PR with required exact-head and post-merge CI green; the branch is deleted after merge.
