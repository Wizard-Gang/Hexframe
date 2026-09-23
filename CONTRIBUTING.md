# Contributing

## Change flow

```
change requirement → permanent change ID → branch → implementation → PR → CI
                   → review → merge → release → production
```

If `implementation_plan.md` exists with open tasks, its first task is the default next controlled change.

## Branch naming

```
hf-063-short-slug
```

## Commit and PR titles

```
[HF-063] [FEAT] Add deterministic projectile entities
```

One primary type per change. See [docs/CHANGE-MANAGEMENT.md](docs/CHANGE-MANAGEMENT.md)
for the full type list, body format, and risk definitions.

## Toolchain

Use Node.js 26.9.0 from `.node-version` and npm 11.19.1 from `packageManager`.
Node 26.9.0 ships that npm release; the Node 26/npm 11 engine policy remains enforced by
`.npmrc`, and CI, Release, and Deploy all resolve Node from `.node-version` before running npm.

Dependency install scripts are disabled unless the exact package version is approved in
`package.json#allowScripts`. Keep that list limited to install scripts required by the locked
dependency graph.

## Command and capability map

Use the [README command and capability map](README.md#command-and-capability-map) as the
single overview of local validation, local development, provider verification/mutation,
dry-run deployment, pull-request CI, release publication, and production deployment.
The provider-specific authorization details below supplement that map.

## GitHub repository settings

`config/github-repository-settings.json` is the reviewable authority for the intended GitHub
merge policy and branch/tag rulesets. `npm run check` validates the comparison logic without
provider credentials; it never reads or mutates live GitHub settings.

Verify live provider state separately with a token that has **Repository Administration: read**
access. With GitHub CLI authentication:

```bash
GH_ADMIN_TOKEN=$(gh auth token) npm run verify:github-settings
```

Repository administrators may apply the committed contract with **Repository Administration:
write** access, then must immediately re-run the read-only verifier:

```bash
GH_ADMIN_TOKEN=... npm run apply:github-settings
GH_ADMIN_TOKEN=... npm run verify:github-settings
```

Tokens stay in the caller's environment. Never commit or print them.

## Before opening a pull request

```bash
npm ci && npm run check && npm run audit:dependencies && git diff --check
```

`npm run check` owns committed-range patch integrity through `PATCH_BASE_SHA` and
`PATCH_HEAD_SHA`. Pull-request CI supplies both from the exact event base/head commits. To
reproduce that check locally, supply both commit SHAs before running `npm run check`; outside
pull-request context the command never guesses or fetches a base and skips only the committed-range
portion. The plain `git diff --check` above remains the working-tree pre-commit check.

`npm run audit:dependencies` requires registry network access and fails closed when the advisory query cannot be completed or trusted; it is deliberately separate from credential-free `npm run check`.

No green CI, no merge.

## Rules that are not negotiable

- `main` accepts controlled changes through pull requests and squash merges only, retaining one controlled commit per change ID. It has no bypass actors and requires `verify`, `change-id`, and `secrets` on a branch current with `main`. No direct pushes or force pushes.
- Published release tags are never moved or deleted.
- Local commands and ordinary CI do not mutate production. Production deploys only from the validated annotated release tag through the protected `production` workflow.
- No credential ever enters the repository, its history, its tests, or its documentation.
- A reverted change keeps its ID; the revert receives a new one.
- A corrective change names what it corrects with a `Corrects:` line.
- Completed implementation-plan tasks are removed by the merge that delivers them; Git/GitHub retains their history.
