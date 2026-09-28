# Implementation plan

## In-chat release automation

Owner direction, 2026-09-28: Hexframe releases must be completable through repository-owned GitHub Actions using the connected GitHub authority available in ChatGPT. Do not require a local checkout, a separately supplied PAT, Work mode, or a manual provider deploy merely because the connector does not expose GitHub's annotated-tag creation API.

HF-161 prepared package version 0.8.0 and merged at `e35a8e8ccc0ac52a2d080142db430107bbeef389`, but no `v0.8.0` tag or GitHub Release exists. The missing transport is narrow: the connector can administer repository changes but cannot create an annotated Git tag object/ref. The repository must own that last mile without weakening immutable release identity.

Wave rules:

- Preserve protected squash-only `main`, required `verify` / `change-id` / `secrets` checks, the immutable `v*` tag ruleset, annotated semantic-version tags, GitHub Releases as release-history authority, and the protected `production` environment.
- Never substitute a lightweight tag, let `gh release create` invent a tag, move/delete/rewrite a published tag, bypass a ruleset/check, or deploy directly from `main`.
- Release cutting may use only the repository-scoped `GITHUB_TOKEN`; do not add a PAT, repository secret, provider secret, DNS mutation, or Cloudflare-side workaround.
- A release cutter may act only after successful CI for a `push` to `main`, must prove the completed CI head is still exact current `origin/main`, and must derive `vX.Y.Z` from the checked-out `package.json`.
- If that semantic tag already exists, the cutter must not create, move, or re-dispatch it. If `main` moved before cutting, it must stop without releasing the stale commit.
- The cutter must create a real annotated tag on the exact validated commit, push only that tag, and verify the remote tag before handing off.
- GitHub intentionally prevents a tag pushed with `GITHUB_TOKEN` from recursively starting the tag-`push` Release workflow. The cutter must therefore dispatch the existing Release workflow at the newly created tag ref. The dispatched run must still prove `github.ref == refs/tags/vX.Y.Z`, `github.ref_type == tag`, annotated-tag identity, package-version equality, and exact checked-out commit before publication or production.
- Keep the existing semantic-tag `push` trigger as a valid release entry path for externally created annotated tags; the new dispatch path is an additional transport, not a second release authority.
- Production remains downstream of successful reproduction and GitHub Release publication. The deploy CLI may accept the exact-tag `push` or exact-tag `workflow_dispatch` event, but every stronger repository/tag/expected-tag/credential/identity guard remains mandatory.
- Because `v0.8.0` has never been created or published, the eventual `v0.8.0` tag will intentionally identify the HF-163 merge commit containing the corrected release machinery rather than the earlier HF-161 preparation commit.
- Standard validation remains pinned `npm ci`, focused tests, canonical credential-free `npm run check`, `npm run audit:dependencies`, committed-range/whitespace validation, exact-head required CI, post-merge CI, and automatic branch deletion.

## Open tasks

### HF-163 — [BUILD] Make validated main self-release through annotated tags

- Dependency: This plan-only HF-162 change is merged; `main` still identifies package version 0.8.0; `v0.8.0` and its GitHub Release are still absent.
- Why: The governed release path is correct after a tag exists, but the connected GitHub surface cannot create the required annotated tag object/ref. Requiring an operator terminal for that one primitive prevents the repository from completing an otherwise repository-owned release from ChatGPT.
- Scope:
  - Add one repository-owned release-cutter workflow triggered only by completion of `CI` for `main`. Require the triggering run to be a successful `push` run, checkout its exact `head_sha` with full history, fetch current `origin/main` and tags, and stop unless that SHA is still exact current `main`.
  - Derive the candidate from `package.json#version`; require exact `X.Y.Z` semantic form and candidate tag `vX.Y.Z`. Treat an existing candidate tag as a non-mutating no-op after verifying it is an annotated release tag; never move or recreate it.
  - Grant the cutter only the GitHub permissions required to create the tag and dispatch the Release workflow. Configure Git identity explicitly, create `git tag -a "$tag" "$validated_sha" -m "$tag"`, push only `refs/tags/$tag`, then re-fetch/inspect the remote ref and prove it is annotated and dereferences to the validated SHA.
  - After that proof, dispatch `.github/workflows/release.yml` through GitHub's workflow-dispatch API with `ref` equal to the exact new tag. Pass the validated source SHA as explicit evidence if needed by the release guard. Do not rely on recursive tag-push triggering from `GITHUB_TOKEN`.
  - Extend `release.yml` to accept the cutter's `workflow_dispatch` entry while retaining the existing exact semantic tag-`push` trigger. Both paths must converge before reproduction and must fail closed unless the run is on an exact semantic tag ref whose annotated identity matches the checked-out commit and `package.json`.
  - Keep `gh release create --verify-tag --generate-notes` after successful `npm ci` and canonical `npm run check`; keep the reusable protected Deploy job strictly downstream of successful publication.
  - Update `scripts/deploy.mjs` so production accepts only the two authorized release events—semantic tag `push` and exact-tag `workflow_dispatch`—while preserving Actions-only execution, repository binding, `GITHUB_REF_TYPE=tag`, exact semantic `GITHUB_REF`, `EXPECTED_TAG`, protected Cloudflare credentials, shared release-identity verification, authenticated live-version verification, and public `version.json` checks.
  - Extend release-workflow, release/deploy-contract, deploy-context, and release-boundary tests so they prove the cutter cannot release stale `main`, cannot create/move an existing tag, cannot use a lightweight tag, cannot dispatch a branch ref, and cannot make arbitrary/manual non-tag execution eligible for production. Add any focused cutter validator/test required and include it in canonical `npm run check`.
  - Update current release-management documentation to describe the green-main CI → annotated tag cutter → exact-tag Release dispatch → GitHub Release → protected Deploy chain and the `GITHUB_TOKEN` recursion boundary. Do not create a second changelog or release ledger.
  - After squash merge and green post-merge CI on the exact HF-163 merge commit, allow the new cutter to create `v0.8.0` on that same commit and dispatch Release. Follow the Release/Deploy chain through production; if the protected `production` environment requires human approval, stop at that genuine boundary and report the exact pending run/job/environment.
- Non-goals: Do not add a PAT or new secret; do not expose production deployment from `workflow_dispatch` on a branch; do not make Deploy independently dispatchable; do not weaken tag immutability, required checks, environment protection, release identity, provider verification, or public identity verification; do not change application gameplay or storage behavior.
- Acceptance:
  - The HF-163 PR contains one controlled commit and passes exact-head `verify`, `change-id`, and `secrets`; squash merge lands on unchanged governed `main` settings and post-merge CI is green.
  - A successful stale CI run cannot cut a tag after `main` advances. A successful current-main CI run with an already existing version tag is a non-mutating no-op.
  - On the HF-163 merge commit, the cutter creates `v0.8.0` as an annotated tag, the tag dereferences to that exact merge SHA, and the remote tag is never subsequently moved or rewritten.
  - The cutter-dispatched Release run executes with `refs/tags/v0.8.0`, passes shared immutable release-identity validation, clean `npm ci`, and canonical `npm run check`, then publishes the GitHub Release with `--verify-tag`.
  - Production remains callable only through Release. If approved, Deploy checks out the exact immutable tag, passes the guarded production CLI, verifies the uploaded Cloudflare Version ID is serving 100%, and public `version.json` reports `v0.8.0` at the exact tagged commit.
  - No provider secret, repository secret, DNS record, Cloudflare routing setting, branch/tag ruleset, or bypass actor is changed to make the release work.
- Risk: High. This changes the release trigger and production eligibility envelope. Fail closed on stale SHA, wrong event, wrong ref type/name, version/tag mismatch, non-annotated tags, duplicate tags, failed reproduction, missing protected credentials, provider verification failure, or public identity mismatch.
- Validation: Focused cutter/release/deploy tests; pinned `npm ci`; `npm run check`; `npm run audit:dependencies`; committed-range `git diff --check`; exact-head PR CI; post-merge CI; cutter run evidence; Git tag-object/ref verification; Release run; protected Deploy run when approved; production `version.json` and route smoke checks.
- Authorities: `AGENTS.md`, `docs/CHANGE-MANAGEMENT.md`, `docs/RELEASE-MANAGEMENT.md`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/deploy.yml`, `scripts/release-identity.mjs`, `scripts/deploy.mjs`, and the committed GitHub settings contract.
