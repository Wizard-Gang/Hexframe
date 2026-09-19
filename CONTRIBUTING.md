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

Use the exact Node.js version in `.node-version` and the exact npm 11 version declared by
`packageManager`. The engine ranges are enforced by `.npmrc`.

Dependency install scripts are disabled unless the exact package version is approved in
`package.json#allowScripts`. Keep that list limited to install scripts required by the locked
dependency graph.

## Before opening a pull request

```bash
npm ci && npm run check && git diff --check
```

No green CI, no merge.

## Rules that are not negotiable

- `main` accepts controlled changes through pull requests and merge commits only. No direct pushes or force pushes.
- Published release tags are never moved or deleted.
- No credential ever enters the repository, its history, its tests, or its documentation.
- A reverted change keeps its ID; the revert receives a new one.
- A corrective change names what it corrects with a `Corrects:` line.
- Completed implementation-plan tasks are removed by the merge that delivers them; Git/GitHub retains their history.
